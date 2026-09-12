import {
  createAssistantMessageEventStream,
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
} from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AcpError } from "./acp-client.ts";
import { AcpSessionManager, debugTiming, type AcpSessionInfo } from "./acp-session.ts";
import {
  persistCatalog,
  startupCatalog,
  toCatalogEntries,
  toPiModels,
  type CatalogEntry,
} from "./catalog.ts";
import { buildTurnPrompt, decidePromptMode } from "./prompt-mapper.ts";
import type { AntigravityBinaryLinkConfig, AntigravityUiReporter } from "./types.ts";

function mapStopReason(acpStopReason: string): "stop" | "length" {
  switch (acpStopReason) {
    case "max_tokens":
    case "max_turn_requests":
      return "length";
    default:
      return "stop";
  }
}

function isAbortLike(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /abort/i.test(message);
}

/**
 * Token estimate for turns. The ACP server reports no usage, so this matches
 * Pi's own convention for usage-less providers (chars / 4). Costs stay zero,
 * which signals "unknown" rather than free.
 */
export function estimateTurnUsage(promptText: string, outputText: string): {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
} {
  const input = Math.ceil(promptText.length / 4);
  const output = Math.ceil(outputText.length / 4);
  return { input, output, cacheRead: 0, cacheWrite: 0, totalTokens: input + output };
}

export class AntigravityProviderRuntime {
  private uiReporter?: AntigravityUiReporter;
  private manager: AcpSessionManager;
  private entries: CatalogEntry[];
  private turnCounts = new Map<string, number>();
  private lastBridgedCounts = new Map<string, number>();

  constructor(linkConfig: AntigravityBinaryLinkConfig = {}, cwd?: string) {
    this.manager = new AcpSessionManager(linkConfig, cwd);
    this.entries = startupCatalog();
  }

  setUiReporter(reporter?: AntigravityUiReporter) {
    this.uiReporter = reporter;
  }

  private emitUi(event: Parameters<AntigravityUiReporter>[0]) {
    try {
      this.uiReporter?.(event);
    } catch {
      // Ignore UI callback errors
    }
  }

  getModels(): Model<Api>[] {
    return toPiModels(this.entries);
  }

  getCatalogEntries(): CatalogEntry[] {
    return [...this.entries];
  }

  /** Replace the catalog; returns true when the model list changed. */
  refreshCatalog(entries: CatalogEntry[], catalogFile?: string): boolean {
    const before = this.entries.map((e) => e.id).join("\n");
    const after = entries.map((e) => e.id).join("\n");
    if (before === after) return false;
    this.entries = entries;
    persistCatalog(entries, catalogFile);
    return true;
  }

  /** Fetch the live catalog (spawns the server on first use). */
  async fetchLiveCatalog(): Promise<CatalogEntry[]> {
    const { session, release } = await this.manager.acquireMain();
    try {
      return toCatalogEntries(session);
    } finally {
      release();
    }
  }

  private catalogRefreshRequested = false;

  /**
   * Fire-and-forget catalog refresh. Never blocks a turn; the picker updates
   * on the next registration when the list actually changed.
   */
  refreshCatalogInBackground(onChanged?: () => void): void {
    if (this.catalogRefreshRequested) return;
    this.catalogRefreshRequested = true;
    void (async () => {
      try {
        const entries = await this.fetchLiveCatalog();
        if (this.refreshCatalog(entries)) onChanged?.();
      } catch {
        // Startup stays usable on the persisted/fallback catalog.
      }
    })();
  }

  stream(
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions,
  ): AssistantMessageEventStream {
    const stream = createAssistantMessageEventStream();

    (async () => {
      this.emitUi({ phase: "start", modelId: model.id });
      // Keep the picker fresh on first use (covers CLI one-shots that never
      // sit through the deferred session_start refresh). Self-guarded, never
      // blocks the turn.
      this.refreshCatalogInBackground();
      // The agent loop only forwards deltas to chat after a "start" event.
      // Without it every delta is swallowed and the whole turn appears as one
      // blob at done. Push first so "Working" streams immediately, even while
      // the server is still cold-starting below.
      stream.push({ type: "start", partial: this.partialMessage(model, "") });
      let session: AcpSessionInfo | undefined;
      let releaseMain: (() => void) | undefined;
      let ephemeral = false;

      try {
        // Prefer the conversational main session; concurrent calls (parallel
        // subagents) get their own ephemeral session on the same process.
        const claim = this.manager.tryClaimMain();
        if (claim) {
          const acquired = await claim;
          session = acquired.session;
          releaseMain = acquired.release;
        } else {
          session = await this.manager.createEphemeral();
          ephemeral = true;
        }

        // Pi thinking slider (options.reasoning) picks the ACP effort variant.
        await this.manager.setModel(session, model.id, options?.reasoning);

        const turn = this.turnCounts.get(session.sessionId) ?? 0;
        // The ACP session only remembers bridged turns. When the user talked
        // to another provider in between (model switching), catch the inner
        // agent up with the missed slice instead of just the latest message.
        const messageCount = Array.isArray(context.messages) ? context.messages.length : 0;
        const mode = ephemeral
          ? "full"
          : decidePromptMode(messageCount, this.lastBridgedCounts.get(session.sessionId), turn, false);
        const prompt =
          mode === "full"
            ? buildTurnPrompt(context, true)
            : typeof mode === "object"
              ? buildTurnPrompt(context, false, mode.catchupFrom)
              : buildTurnPrompt(context, false);
        this.turnCounts.set(session.sessionId, turn + 1);
        this.lastBridgedCounts.set(session.sessionId, messageCount);

        let fullText = "";
        let fullThinking = "";
        let thinkingStarted = false;
        let thinkingEnded = false;
        let textStarted = false;
        const textIndex = () => (thinkingStarted ? 1 : 0);
        // Keyed on thinkingStarted, not non-empty text: thinking_start must
        // already carry the thinking block or the chat component has nothing
        // to attach live deltas to, and everything appears as one end blob.
        const partialWith = () =>
          this.partialMessage(model, fullText, thinkingStarted ? fullThinking : undefined);

        const turnStarted = Date.now();
        let firstEventLogged = false;
        const logFirstEvent = (kind: string) => {
          if (firstEventLogged) return;
          firstEventLogged = true;
          debugTiming(`acp-first-${kind}`, turnStarted);
        };
        const unsubscribeText = this.manager.onText((sessionId, text) => {
          if (sessionId !== session!.sessionId) return;
          logFirstEvent("text");
          if (!textStarted) {
            textStarted = true;
            if (thinkingStarted && !thinkingEnded) {
              thinkingEnded = true;
              stream.push({
                type: "thinking_end",
                contentIndex: 0,
                content: fullThinking,
                partial: partialWith(),
              });
            }
            stream.push({ type: "text_start", contentIndex: textIndex(), partial: partialWith() });
          }
          fullText += text;
          this.emitUi({ phase: "streaming", modelId: model.id });
          stream.push({
            type: "text_delta",
            contentIndex: textIndex(),
            delta: text,
            partial: partialWith(),
          });
        });
        const unsubscribeThought = this.manager.onThought((sessionId, text) => {
          if (sessionId !== session!.sessionId) return;
          logFirstEvent("thought");
          if (!thinkingStarted) {
            thinkingStarted = true;
            stream.push({ type: "thinking_start", contentIndex: 0, partial: partialWith() });
          }
          fullThinking += text;
          this.emitUi({ phase: "thinking", modelId: model.id, message: text.slice(0, 120) });
          stream.push({
            type: "thinking_delta",
            contentIndex: 0,
            delta: text,
            partial: partialWith(),
          });
        });
        const pushThinkingLine = (line: string) => {
          if (!thinkingStarted) {
            thinkingStarted = true;
            stream.push({ type: "thinking_start", contentIndex: 0, partial: partialWith() });
          }
          fullThinking += line;
          stream.push({
            type: "thinking_delta",
            contentIndex: 0,
            delta: line,
            partial: partialWith(),
          });
        };
        const unsubscribeActivity = this.manager.onActivity((sessionId, message) => {
          if (sessionId !== session!.sessionId) return;
          logFirstEvent("activity");
          const phase = message.startsWith("plan") ? "plan" : "tool_activity";
          this.emitUi({ phase, modelId: model.id, message });
          // Mirror into the thinking block so progress streams in chat, not
          // just the footer. The inner agent's tool loops otherwise look like
          // a hung turn. Labeled as tool activity, never as model reasoning.
          pushThinkingLine(`\n[${phase === "plan" ? "plan" : "tool"}] ${message}`);
        });

        try {
          const stopReason = await this.manager.prompt(session, prompt, options?.signal);
          const reason = mapStopReason(stopReason);
          if (thinkingStarted && !thinkingEnded) {
            stream.push({
              type: "thinking_end",
              contentIndex: 0,
              content: fullThinking,
              partial: partialWith(),
            });
          }
          if (textStarted) {
            stream.push({
              type: "text_end",
              contentIndex: textIndex(),
              content: fullText,
              partial: partialWith(),
            });
          }
          stream.push({
            type: "done",
            reason,
            message: this.doneMessage(
              model,
              fullText,
              reason,
              fullThinking ? fullThinking : undefined,
              prompt,
            ),
          });
          this.emitUi({ phase: "success", modelId: model.id });
        } finally {
          unsubscribeText();
          unsubscribeThought();
          unsubscribeActivity();
        }
        stream.end();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const aborted = isAbortLike(error, options?.signal);
        this.emitUi({ phase: "error", modelId: model.id, message: aborted ? "Request was aborted" : err.message });
        stream.push({
          type: "error",
          reason: aborted ? "aborted" : "error",
          error: this.errorMessage(model, aborted ? "Request was aborted" : err.message, aborted ? "aborted" : "error"),
        });
        stream.end();
      } finally {
        if (releaseMain) {
          releaseMain();
        } else if (session && ephemeral) {
          await this.manager.closeSession(session);
        }
      }
    })();

    return stream;
  }

  private baseMessage(
    model: Model<Api>,
    usage?: { input: number; output: number; cacheRead: number; cacheWrite: number; totalTokens: number },
  ): Omit<AssistantMessage, "content" | "stopReason"> {
    return {
      role: "assistant",
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: usage?.input ?? 0,
        output: usage?.output ?? 0,
        cacheRead: usage?.cacheRead ?? 0,
        cacheWrite: usage?.cacheWrite ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      timestamp: Date.now(),
    };
  }

  private partialMessage(model: Model<Api>, fullText: string, thinking?: string): AssistantMessage {
    return {
      ...this.baseMessage(model),
      content: [
        ...(thinking !== undefined ? [{ type: "thinking", thinking } as const] : []),
        { type: "text", text: fullText },
      ],
      stopReason: "stop",
    };
  }

  private doneMessage(
    model: Model<Api>,
    fullText: string,
    reason: "stop" | "length",
    thinking?: string,
    promptText?: string,
  ): AssistantMessage {
    const usage = estimateTurnUsage(promptText ?? "", fullText + (thinking ?? ""));
    return {
      ...this.baseMessage(model, usage),
      content: [
        ...(thinking !== undefined ? [{ type: "thinking", thinking } as const] : []),
        { type: "text", text: fullText },
      ],
      stopReason: reason,
    };
  }

  private errorMessage(model: Model<Api>, message: string, stopReason: "error" | "aborted"): AssistantMessage {
    return {
      ...this.baseMessage(model),
      content: [],
      stopReason,
      errorMessage: message,
    };
  }

  shutdown(): void {
    this.manager.shutdown();
    this.turnCounts.clear();
    this.lastBridgedCounts.clear();
  }
}

export function registerAntigravityProvider(pi: ExtensionAPI, runtime: AntigravityProviderRuntime) {
  pi.registerProvider("antigravity", {
    baseUrl: "acp://antigravity",
    apiKey: "antigravity-acp",
    api: "antigravity-acp" as Api,
    models: runtime.getModels(),
    streamSimple: (model, context, options) => runtime.stream(model, context, options),
  });
}

export { AcpError };

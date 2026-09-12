import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AcpClient, AcpError } from "./acp-client.ts";
import { resolveAntigravityBinary, type AntigravityBinaryConfig } from "./binary.ts";
import type { AntigravityBinaryLinkConfig } from "./types.ts";

/**
 * Phase timing log for slow-turn diagnosis. Off by default; enable with
 * ANTIGRAVITY_DEBUG=1. Appends to ~/.takomi/antigravity-debug.log.
 */
export function debugTiming(phase: string, startedAt: number): void {
  if (process.env.ANTIGRAVITY_DEBUG !== "1") return;
  try {
    const elapsed = Date.now() - startedAt;
    const line = `${new Date().toISOString()} ${phase} +${elapsed}ms\n`;
    const file = path.join(os.homedir(), ".takomi", "antigravity-debug.log");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, line, "utf8");
  } catch {
    // Diagnosis must never break turns.
  }
}

/**
 * Owns one ACP process and the sessions multiplexed over it.
 *
 * Tool policy is unlimited (explicit user decision): permission requests are
 * answered with the agent-preferred allow option, and the client advertises
 * no fs/terminal mediation so the agent uses its own tools directly. Both
 * main-agent turns and spawned subagents execute freely.
 */

export interface AcpSessionInfo {
  sessionId: string;
  modelConfigId: string;
  currentModel?: string;
  configOptions: Array<{
    id: string;
    type?: string;
    currentValue?: unknown;
    options?: Array<{ value: string; name?: string } | { options: Array<{ value: string; name?: string }> }>;
  }>;
  availableModels: Array<{ modelId: string; name: string }>;
}

interface SessionUpdateNotification {
  sessionId: string;
  update: { sessionUpdate: string; content?: unknown; [key: string]: unknown };
}

export type SessionTextHandler = (sessionId: string, text: string) => void;
export type SessionThoughtHandler = (sessionId: string, text: string) => void;
export type SessionActivityHandler = (sessionId: string, message: string) => void;

const SIGN_IN_HINT =
  "Sign in to Antigravity first (run `agy login`, or use T3 Code Settings > Providers > Antigravity) and retry.";

function isSignInError(error: unknown): boolean {
  if (!(error instanceof AcpError)) return false;
  // T3 maps native auth failures to JSON-RPC -32000 (antigravityAuthSupport.ts).
  return error.code === -32000 || /sign.?in|auth|login/i.test(error.message);
}

const EFFORT_ORDER = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

function splitEffort(modelId: string): { base: string; effort?: string } {
  const match = modelId.match(/-(off|minimal|low|medium|high|xhigh|max)$/i);
  if (!match) return { base: modelId };
  return { base: modelId.slice(0, -match[0].length), effort: match[1].toLowerCase() };
}

function pickVariant(
  candidates: string[],
  base: string,
  effort: string | undefined,
): string | undefined {
  if (candidates.length === 0) return undefined;
  if (!effort || effort === "off") {
    const exactBase = candidates.find((c) => c.toLowerCase() === base.toLowerCase());
    if (exactBase) return exactBase;
    const noEffort = candidates.find((c) => !splitEffort(c).effort);
    return noEffort ?? candidates[0];
  }
  const want = effort.toLowerCase();
  const exact = candidates.find((c) => splitEffort(c).effort === want);
  if (exact) return exact;
  const wantIdx = EFFORT_ORDER.indexOf(want);
  if (wantIdx === -1) return candidates[0];
  const ranked = [...candidates].sort((a, b) => {
    const ai = EFFORT_ORDER.indexOf(splitEffort(a).effort ?? "medium");
    const bi = EFFORT_ORDER.indexOf(splitEffort(b).effort ?? "medium");
    return Math.abs(ai - wantIdx) - Math.abs(bi - wantIdx);
  });
  return ranked[0];
}

/** Prefer the stickiest allow option the agent offers. */
export function selectAllowOptionId(
  options: Array<{ optionId?: string; kind?: string }>,
): string | undefined {
  const valid = options.filter((o) => o.optionId?.trim());
  return (
    valid.find((o) => o.kind === "allow_always")?.optionId?.trim() ||
    valid.find((o) => o.kind === "allow_once")?.optionId?.trim() ||
    valid[0]?.optionId?.trim()
  );
}

function extractModelOptions(configOptions: AcpSessionInfo["configOptions"]): Array<{
  value: string;
  name: string;
}> {
  const model = configOptions.find((o) => o.id === "model");
  const raw = (model as { options?: unknown } | undefined)?.options;
  if (!Array.isArray(raw)) return [];
  const out: Array<{ value: string; name: string }> = [];
  for (const entry of raw as Array<Record<string, unknown>>) {
    if (typeof entry.value === "string") {
      out.push({ value: entry.value, name: typeof entry.name === "string" ? entry.name : entry.value });
    } else if (Array.isArray(entry.options)) {
      for (const nested of entry.options as Array<Record<string, unknown>>) {
        if (typeof nested.value === "string") {
          out.push({ value: nested.value, name: typeof nested.name === "string" ? nested.name : nested.value });
        }
      }
    }
  }
  return out;
}

export class AcpSessionManager {
  private client?: AcpClient;
  private launched = false;
  private mainSession?: AcpSessionInfo;
  private mainInUse = false;
  private waiters: Array<() => void> = [];
  private textHandlers = new Set<SessionTextHandler>();
  private thoughtHandlers = new Set<SessionThoughtHandler>();
  private activityHandlers = new Set<SessionActivityHandler>();
  private cancelledSessions = new Set<string>();
  private linkConfig: AntigravityBinaryLinkConfig & AntigravityBinaryConfig;
  private cwd: string;

  constructor(linkConfig: AntigravityBinaryLinkConfig = {}, cwd?: string) {
    this.linkConfig = linkConfig;
    this.cwd = cwd ?? process.cwd();
  }

  onText(handler: SessionTextHandler): () => void {
    this.textHandlers.add(handler);
    return () => {
      this.textHandlers.delete(handler);
    };
  }

  onThought(handler: SessionThoughtHandler): () => void {
    this.thoughtHandlers.add(handler);
    return () => {
      this.thoughtHandlers.delete(handler);
    };
  }

  onActivity(handler: SessionActivityHandler): () => void {
    this.activityHandlers.add(handler);
    return () => {
      this.activityHandlers.delete(handler);
    };
  }

  private emitText(sessionId: string, text: string): void {
    for (const handler of [...this.textHandlers]) {
      try {
        handler(sessionId, text);
      } catch {
        // Listener errors must not break streaming.
      }
    }
  }

  private emitThought(sessionId: string, text: string): void {
    for (const handler of [...this.thoughtHandlers]) {
      try {
        handler(sessionId, text);
      } catch {
        // Listener errors must not break streaming.
      }
    }
  }

  private emitActivity(sessionId: string, message: string): void {
    for (const handler of [...this.activityHandlers]) {
      try {
        handler(sessionId, message);
      } catch {
        // Listener errors must not break streaming.
      }
    }
  }

  private ensureClient(): AcpClient {
    if (this.client) return this.client;
    const binary = resolveAntigravityBinary(this.linkConfig);
    if (!binary.executablePath || !binary.harnessPath) {
      throw new AcpError(`No Antigravity server available. ${binary.detail}`);
    }
    const client = AcpClient.launch({
      executablePath: binary.executablePath,
      harnessPath: binary.harnessPath,
      cwd: this.cwd,
    });
    client.onNotification("session/update", (params) => this.onSessionUpdate(params));
    // Unlimited policy: auto-allow every tool permission request.
    client.onRequest("session/request_permission", (params) => {
      const options = (params as { options?: Array<{ optionId?: string; kind?: string }> })?.options ?? [];
      const optionId = selectAllowOptionId(options);
      if (!optionId) return { outcome: { outcome: "cancelled" } };
      return { outcome: { outcome: "selected", optionId } };
    });
    // Elicitation (questions with fixed choices): decline so the turn continues.
    client.onRequest("session/elicitation", () => ({ action: "decline" }));
    this.client = client;
    return client;
  }

  private onSessionUpdate(params: unknown): void {
    const notification = params as SessionUpdateNotification;
    if (!notification || typeof notification.sessionId !== "string") return;
    const update = notification.update;
    if (!update || typeof update.sessionUpdate !== "string") return;
    const sessionId = notification.sessionId;

    if (
      update.sessionUpdate === "agent_message_chunk" ||
      update.sessionUpdate === "agent_thought_chunk"
    ) {
      const content = update.content as
        | { type?: string; text?: string }
        | Array<{ type?: string; text?: string }>
        | undefined;
      const chunks = Array.isArray(content) ? content : content ? [content] : [];
      for (const chunk of chunks) {
        if (chunk?.type === "text" && typeof chunk.text === "string" && chunk.text) {
          if (update.sessionUpdate === "agent_thought_chunk") {
            this.emitThought(sessionId, chunk.text);
          } else {
            this.emitText(sessionId, chunk.text);
          }
        }
      }
      return;
    }

    // Tool activity: surface as status text so turns no longer look stuck
    // while the inner agent works. Pi still owns real tool execution.
    if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
      const record = update as Record<string, unknown>;
      const nested = (record.toolCall ?? record.tool_call) as Record<string, unknown> | undefined;
      const nestedContent = (nested?.content ?? record.content) as
        | { type?: string; text?: string; title?: string }
        | Array<{ type?: string; text?: string; title?: string }>
        | undefined;
      const chunks = Array.isArray(nestedContent)
        ? nestedContent
        : nestedContent
          ? [nestedContent]
          : [];
      const contentTitle = chunks.find((c) => typeof c?.title === "string" && c.title)?.title;
      const rawTitle =
        (typeof record.title === "string" && record.title) ||
        (typeof nested?.title === "string" && nested.title) ||
        (typeof nested?.name === "string" && nested.name) ||
        (typeof record.name === "string" && record.name) ||
        contentTitle ||
        "";
      const id =
        (typeof record.toolCallId === "string" && record.toolCallId) ||
        (typeof nested?.toolCallId === "string" && nested.toolCallId) ||
        "";
      const shortId =
        id.length > 12 ? `${id.slice(0, 8)}…` : id;
      const title = rawTitle || (shortId ? `tool ${shortId}` : "tool call");
      const status =
        typeof record.status === "string" && record.status ? ` (${record.status})` : "";
      this.emitActivity(sessionId, `${title}${status}`);
      return;
    }

    if (update.sessionUpdate === "plan") {
      const record = update as Record<string, unknown>;
      const entries = Array.isArray(record.entries) ? record.entries : [];
      const current = entries.find(
        (e) => e && typeof e === "object" && (e as Record<string, unknown>).status === "in_progress",
      ) as Record<string, unknown> | undefined;
      const content = typeof current?.content === "string" ? current.content : undefined;
      this.emitActivity(sessionId, content ? `plan: ${content}` : "plan updated");
      return;
    }
  }

  private async initializeOnce(): Promise<void> {
    if (this.launched) return;
    const bootStarted = Date.now();
    const client = this.ensureClient();
    debugTiming("acp-spawn", bootStarted);
    try {
      await client.request("initialize", {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: false, writeTextFile: false },
          terminal: false,
        },
        clientInfo: { name: "takomi-antigravity-provider", version: "1.0.0" },
      });
    } catch (error) {
      if (isSignInError(error)) throw new AcpError(`Antigravity sign-in required. ${SIGN_IN_HINT}`, (error as AcpError).code);
      throw error;
    }
    debugTiming("acp-initialize", bootStarted);
    // Personal Google account flow reuses the stored login; a no-op when
    // tokens already exist. Never fail startup if the agent says otherwise —
    // session/new will report authoritatively.
    try {
      await client.request("authenticate", { methodId: "oauth-personal" }, 30_000);
    } catch {
      // Fall through; session/new is authoritative on auth state.
    }
    debugTiming("acp-authenticate", bootStarted);
    this.launched = true;
  }

  private toSessionInfo(sessionId: string, result: Record<string, unknown>): AcpSessionInfo {
    const configOptions = (Array.isArray(result.configOptions) ? result.configOptions : []) as AcpSessionInfo["configOptions"];
    const models = result.models as
      | { availableModels?: Array<{ modelId: string; name: string }>; currentModelId?: string }
      | undefined;
    const availableModels = Array.isArray(models?.availableModels)
      ? models!.availableModels.filter((m) => typeof m?.modelId === "string")
      : [];
    const fromOptions = availableModels.length === 0 ? extractModelOptions(configOptions) : [];
    return {
      sessionId,
      modelConfigId: "model",
      currentModel:
        typeof models?.currentModelId === "string" ? models.currentModelId : undefined,
      configOptions,
      availableModels:
        availableModels.length > 0
          ? availableModels
          : fromOptions.map((o) => ({ modelId: o.value, name: o.name })),
    };
  }

  private async createSession(): Promise<AcpSessionInfo> {
    const turnStarted = Date.now();
    await this.initializeOnce();
    const client = this.ensureClient();
    let result: unknown;
    try {
      result = await client.request("session/new", { cwd: this.cwd, mcpServers: [] });
      debugTiming("acp-session-new", turnStarted);
    } catch (error) {
      if (isSignInError(error)) throw new AcpError(`Antigravity sign-in required. ${SIGN_IN_HINT}`, (error as AcpError).code);
      throw error;
    }
    const record = (result ?? {}) as Record<string, unknown>;
    if (typeof record.sessionId !== "string") {
      throw new AcpError("ACP server returned a session without an id");
    }
    return this.toSessionInfo(record.sessionId, record);
  }

  /** Main session for sequential turns (conversation continuity). */
  async acquireMain(): Promise<{ session: AcpSessionInfo; release: () => void }> {
    while (this.mainInUse) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    const claimed = this.tryClaimMain();
    if (!claimed) {
      // Lost a race with another claimant; wait our turn.
      await new Promise<void>((resolve) => this.waiters.push(resolve));
      return this.acquireMain();
    }
    return claimed;
  }

  /**
   * Claim the main session without waiting. Returns undefined when another
   * turn holds it — the caller should use an ephemeral session instead of
   * serializing parallel subagents behind a long turn.
   */
  tryClaimMain(): Promise<{ session: AcpSessionInfo; release: () => void }> | undefined {
    if (this.mainInUse) return undefined;
    this.mainInUse = true;
    return (async () => {
      try {
        if (!this.mainSession) this.mainSession = await this.createSession();
        return { session: this.mainSession, release: () => this.releaseMain() };
      } catch (error) {
        this.releaseMain();
        throw error;
      }
    })();
  }

  private releaseMain(): void {
    this.mainInUse = false;
    this.pumpWaiters();
  }

  /** Ephemeral session for concurrent calls (e.g. parallel subagents). */
  async createEphemeral(): Promise<AcpSessionInfo> {
    return this.createSession();
  }

  async closeSession(session: AcpSessionInfo): Promise<void> {
    if (this.mainSession?.sessionId === session.sessionId) return;
    try {
      await this.ensureClient().request("session/close", { sessionId: session.sessionId }, 15_000);
    } catch {
      // Close is best-effort; dropping the id is sufficient.
    }
  }

  async setModel(session: AcpSessionInfo, modelId: string, reasoning?: string): Promise<void> {
    let raw = modelId.replace(/^antigravity\//, "");
    if (raw === "antigravity-default") return; // alias: keep agent's current selection
    // Pi's thinking slider arrives as "model:high" (see modelWithThinking in
    // the subagent engine) or via options.reasoning. ACP effort variants use
    // a dash suffix ("base-high"), so translate before sending.
    let requestedEffort: string | undefined;
    const colon = raw.match(/:(off|minimal|low|medium|high|xhigh|max)$/i);
    if (colon) {
      requestedEffort = colon[1].toLowerCase();
      raw = raw.slice(0, -colon[0].length);
    }
    if (!requestedEffort && reasoning) requestedEffort = reasoning.toLowerCase();
    const resolved = this.resolveModelVariant(session, raw, requestedEffort);
    if (session.currentModel === resolved) return;
    try {
      await this.ensureClient().request("session/set_config_option", {
        sessionId: session.sessionId,
        configId: session.modelConfigId,
        value: resolved,
      });
      session.currentModel = resolved;
    } catch (error) {
      throw new AcpError(
        `Antigravity model '${resolved}' is unavailable for this Google account. Select an available model. (${error instanceof Error ? error.message : String(error)})`,
      );
    }
  }

  /**
   * Resolve a requested Pi model id to a concrete ACP model value.
   * Accepts grouped base ids ("gemini-3.8-flash"), full variant ids
   * ("gemini-3.8-flash-high"), and legacy ":effort" suffixes. Unknown bases
   * pass through unchanged so the server stays authoritative.
   */
  private resolveModelVariant(
    session: AcpSessionInfo,
    raw: string,
    requestedEffort: string | undefined,
  ): string {
    const known = session.availableModels.map((m) => m.modelId);
    if (known.includes(raw)) {
      if (!requestedEffort) return raw;
      // A full variant id plus an explicit effort: rebase onto the effort.
      const { base, effort } = splitEffort(raw);
      if (effort && effort.toLowerCase() === requestedEffort) return raw;
      const sibling = pickVariant(known, base, requestedEffort);
      return sibling ?? raw;
    }
    const candidates = known.filter(
      (id) => id === raw || id.toLowerCase().startsWith(`${raw.toLowerCase()}-`),
    );
    if (candidates.length === 0) return raw;
    return pickVariant(candidates, raw, requestedEffort) ?? raw;
  }

  async prompt(session: AcpSessionInfo, text: string, signal?: AbortSignal): Promise<string> {
    const client = this.ensureClient();
    this.cancelledSessions.delete(session.sessionId);
    if (signal?.aborted) {
      this.cancelledSessions.add(session.sessionId);
      throw new AcpError("Request was aborted before execution");
    }
    let onAbort: (() => void) | undefined;
    const resultPromise = client.request(
      "session/prompt",
      { sessionId: session.sessionId, prompt: [{ type: "text", text }] },
      0, // no client-side timeout; the turn ends when the agent replies
    );
    if (signal) {
      onAbort = () => {
        this.cancelledSessions.add(session.sessionId);
        try {
          client.notify("session/cancel", { sessionId: session.sessionId });
        } catch {
          // Best-effort; the pending request still settles below.
        }
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
    try {
      const result = (await resultPromise) as { stopReason?: string };
      void result?.stopReason;
      return result?.stopReason ?? "end_turn";
    } catch (error) {
      if (signal?.aborted || this.cancelledSessions.has(session.sessionId)) {
        throw new AcpError("Request was aborted");
      }
      throw error;
    } finally {
      if (signal && onAbort) signal.removeEventListener("abort", onAbort);
    }
  }

  cancel(session: AcpSessionInfo): void {
    this.cancelledSessions.add(session.sessionId);
    try {
      this.ensureClient().notify("session/cancel", { sessionId: session.sessionId });
    } catch {
      // Best-effort.
    }
  }

  isCancelled(session: AcpSessionInfo): boolean {
    return this.cancelledSessions.has(session.sessionId);
  }

  shutdown(): void {
    this.client?.kill();
    this.client = undefined;
    this.launched = false;
    this.mainSession = undefined;
  }

  private pumpWaiters(): void {
    const next = this.waiters.shift();
    next?.();
  }
}

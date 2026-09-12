import type { Context } from "@earendil-works/pi-ai";

/**
 * Maps a Pi turn context to ACP prompt text.
 *
 * The ACP session holds conversation history server-side, so repeat turns
 * send only the latest user message. The first turn on a session carries the
 * system prompt plus the transcript Pi hands us, so resumed/ephemeral
 * sessions start with full context.
 */

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

export function countNonTextParts(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  return content.filter(
    (part) =>
      part &&
      typeof part === "object" &&
      !("text" in part && typeof (part as { text: unknown }).text === "string"),
  ).length;
}

export type PromptMode = "full" | "delta" | { catchupFrom: number };

/**
 * Decide how much transcript a turn needs. The ACP session remembers only
 * the turns bridged through it, so when other-provider turns happened in
 * between (model switching), the gap must be caught up or the inner agent
 * answers without knowing what the other model discussed.
 */
export function decidePromptMode(
  messageCount: number,
  lastBridgedCount: number | undefined,
  turn: number,
  ephemeral: boolean,
): PromptMode {
  if (turn === 0 || ephemeral || lastBridgedCount === undefined) return "full";
  if (messageCount < lastBridgedCount) return "full"; // history rewritten (compaction)
  if (messageCount - lastBridgedCount > 2) return { catchupFrom: lastBridgedCount };
  return "delta";
}

function formatHistory(messages: Array<{ role: string; content: unknown }>): string {
  return messages
    .map((msg) => {
      const text = extractText(msg.content).trim();
      if (!text) return "";
      const role =
        msg.role === "assistant"
          ? "ASSISTANT"
          : msg.role === "user"
            ? "USER"
            : String(msg.role).toUpperCase();
      return `[${role}]\n${text}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function buildTurnPrompt(context: Context, isFirstTurn: boolean, catchupFrom?: number): string {
  const messages = Array.isArray(context.messages) ? context.messages : [];
  const last = messages.length > 0 ? messages[messages.length - 1] : undefined;
  const latestText = last ? extractText(last.content).trim() : "";
  const nonTextCount = last ? countNonTextParts(last.content) : 0;
  const attachmentNote =
    nonTextCount > 0
      ? `\n\n[NOTE: ${nonTextCount} non-text content part(s) were omitted; only text is bridged in this version.]`
      : "";

  if (!isFirstTurn && catchupFrom === undefined) {
    return `${latestText || "(empty message)"}${attachmentNote}`;
  }

  const parts: string[] = [];
  if (isFirstTurn && context.systemPrompt) {
    parts.push(`[SYSTEM]\n${context.systemPrompt}`);
  }
  const sliceFrom =
    !isFirstTurn && catchupFrom !== undefined
      ? Math.max(0, Math.min(catchupFrom, messages.length - 1))
      : 0;
  // Skip our own last bridged response on catch-up: the server already holds
  // it, and re-sending it would duplicate the most recent assistant turn.
  // (Aborted turns leave a user message at that index, which must be kept.)
  let start = sliceFrom;
  if (!isFirstTurn && messages[start]?.role === "assistant") start += 1;
  const history = formatHistory(messages.slice(start, -1));
  if (history) {
    parts.push(
      isFirstTurn
        ? `[HISTORY]\n${history}`
        : `[CATCH-UP: turns you missed while another model answered]\n${history}`,
    );
  }
  parts.push(`[CURRENT USER REQUEST]\n${latestText || "(empty message)"}${attachmentNote}`);
  return parts.join("\n\n");
}

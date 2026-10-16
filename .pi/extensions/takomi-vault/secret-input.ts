import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { decodeKittyPrintable, isKeyRelease, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

export function supportsSecretEntry(ctx: ExtensionContext): boolean {
  return ctx.hasUI && (ctx.mode === "tui" || (ctx.mode === "rpc" && process.env.T3_TAKOMI_VAULT_SECRET_UI === "1"));
}

// Each validated execute owns its own signal and native identity, including parallel calls.
export function vaultSecretInvocation(pi: ExtensionAPI, ctx: ExtensionContext, toolCallId: string, signal: AbortSignal | undefined) {
  let sessionId = "";
  try { sessionId = ctx.sessionManager.getSessionId(); } catch { /* Chat scopes fail closed at approval. */ }
  const controller = new AbortController();
  const abort = () => controller.abort();
  const unsubscribe = [
    pi.on("agent_settled", abort),
    pi.on("session_shutdown", abort),
    pi.on("session_before_switch", abort),
    pi.on("session_before_fork", abort),
    pi.on("session_before_tree", abort),
  ];
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  return {
    toolCallId,
    sessionId,
    signal: controller.signal,
    dispose() {
      abort();
      signal?.removeEventListener("abort", abort);
      for (const off of unsubscribe) off();
    },
  };
}

type VaultSecretInvocation = ReturnType<typeof vaultSecretInvocation>;

interface VaultSecretDisplayContext {
  fieldName: string;
  service: string;
  host: string;
  purpose?: string;
}

// Keep the optional public context inside the existing bounded ownership envelope.
function displayText(value: string, limit: number): boolean {
  return value.trim().length > 0 && value.length <= limit && !/\p{Cc}/u.test(value);
}

export async function maskedSecret(ctx: ExtensionContext, title: string, invocation?: VaultSecretInvocation,
  context?: VaultSecretDisplayContext): Promise<string | null> {
  if (!supportsSecretEntry(ctx)) throw new Error("Secret entry requires an interactive Pi TUI or a supported RPC secret UI.");
  if (ctx.mode === "rpc") {
    // Slash commands keep their existing admission. Model calls must carry ownership.
    if (!invocation) return await ctx.ui.input(`[takomi-vault-secret] ${title}`) || null;
    // Capability negotiation only, not proof of execution or process authenticity.
    if (process.env.T3_TAKOMI_VAULT_OWNERSHIP_NOTIFY !== "1") return null;
    if (invocation.signal.aborted || ctx.sessionManager.getSessionId() !== invocation.sessionId ||
      invocation.sessionId.length === 0 || invocation.sessionId.length > 256 || invocation.toolCallId.length === 0 ||
      invocation.toolCallId.length > 256) return null;
    const requestId = randomUUID();
    const record = { type: "takomi_vault_secret_input", version: 1, requestId,
      toolCallId: invocation.toolCallId, sessionId: invocation.sessionId };
    // Native RPC owns stdout. Its public notify writer bypasses the diagnostic guard.
    const displayContext = context && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(context.fieldName) &&
      displayText(context.service, 128) && displayText(context.host, 253) &&
      (context.purpose === undefined || displayText(context.purpose, 512))
      ? { fieldName: context.fieldName, service: context.service, host: context.host,
          ...(context.purpose === undefined ? {} : { purpose: context.purpose }) }
      : undefined;
    const prefix = "[takomi-vault-ownership:v1] ";
    const notification = `${prefix}${JSON.stringify({ ...record, phase: "open",
      ...(displayContext ? { displayContext } : {}) })}`;
    // JSON escaping can exceed the transport limit even with bounded string lengths.
    ctx.ui.notify(notification.length <= 4096 ? notification :
      `${prefix}${JSON.stringify({ ...record, phase: "open" })}`, "info");
    try {
      const value = await ctx.ui.input(`[takomi-vault-secret] ${title}`,
        `[takomi-vault-owner:v1] ${requestId}`, { signal: invocation.signal });
      return !invocation.signal.aborted && ctx.sessionManager.getSessionId() === invocation.sessionId ? value || null : null;
    } finally {
      ctx.ui.notify(`${prefix}${JSON.stringify({ ...record, phase: "close" })}`, "info");
    }
  }
  return ctx.ui.custom<string | null>((tui, theme, keybindings, done) => {
    let value = "";
    return {
      render(width) {
        // Do not render any portion of the value, including pasted newlines or terminal escapes.
        return [
          truncateToWidth(theme.fg("accent", title), width),
          truncateToWidth(theme.fg("muted", `Secret: ${"•".repeat(Math.min(value.length, 32))}${value.length > 32 ? "…" : ""}`), width),
          truncateToWidth(theme.fg("dim", "Enter to provide, Esc to cancel. Backspace to edit."), width),
        ];
      },
      invalidate() {},
      handleInput(data) {
        if (isKeyRelease(data)) return;
        if (keybindings.matches(data, "tui.select.cancel") || matchesKey(data, Key.escape)) {
          value = "";
          done(null);
        } else if (keybindings.matches(data, "tui.input.submit")) {
          const result = value;
          value = "";
          done(result || null);
        } else if (keybindings.matches(data, "tui.editor.deleteCharBackward")) {
          value = Array.from(value).slice(0, -1).join("");
        } else if (keybindings.matches(data, "tui.editor.deleteToLineStart")) {
          value = "";
        } else {
          const paste = data.match(/^\x1b\[200~([\s\S]*)\x1b\[201~$/);
          const typed = paste ? paste[1] : decodeKittyPrintable(data) ?? (/^[^\x00-\x1f\x7f\x1b]+$/u.test(data) ? data : "");
          if (typed && !/[\x00\x1b\x7f]/.test(typed) && value.length + typed.length <= 65536) value += typed;
        }
        tui.requestRender();
      },
    };
  });
}

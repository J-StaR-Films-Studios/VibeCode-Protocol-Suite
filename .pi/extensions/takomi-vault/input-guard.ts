import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Deliberately narrow: this hook is advisory, not a general DLP filter.
export function containsLikelySecret(text: string): boolean {
  return /-----BEGIN (RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\s]{64,}-----END \1PRIVATE KEY-----/.test(text)
    || /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/.test(text)
    || /\bgithub_pat_[A-Za-z0-9_]{82}\b/.test(text)
    || /\b(?:AWS_ACCESS_KEY_ID|aws_access_key_id)\s*[:=]\s*AKIA[A-Z0-9]{16}\b/.test(text);
}

export function registerVaultInputGuard(pi: ExtensionAPI) {
  pi.on("input", async (event, ctx) => {
    if (!containsLikelySecret(event.text)) return { action: "continue" };
    if (ctx.mode !== "tui" || !ctx.hasUI) return { action: "handled" };
    const send = await ctx.ui.confirm("Possible secret in chat", "This looks like a private key or access token. Use /vault-add or vault_request instead. Send the original message anyway?");
    if (send) return { action: "continue" };
    ctx.ui.notify("Message not sent. Use /vault-add or ask the agent to call vault_request.", "warning");
    return { action: "handled" };
  });
}

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { logAudit } from "./audit.ts";
import { cleanupTempFiles } from "./adapters.ts";
import { clearKeyCache, peekBackend } from "./crypto-store.ts";
import { revokeExpiredSessionGrants, revokeGrants } from "./grant-store.ts";
import { registerVaultCommands } from "./commands.ts";
import { registerVaultTools } from "./tools.ts";
import { registerVaultInputGuard } from "./input-guard.ts";

function safeStatus(ctx: ExtensionContext) {
  try {
    revokeExpiredSessionGrants();
    if (ctx.hasUI) ctx.ui.setStatus("takomi-vault", `takomi-vault | ${peekBackend()}`);
  } catch {
    // Status is best-effort and must never disturb the session.
  }
}

export default function (pi: ExtensionAPI) {
  registerVaultTools(pi);
  registerVaultCommands(pi);
  registerVaultInputGuard(pi);

  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    safeStatus(ctx);
  });

  pi.on("turn_start", async (_event, ctx: ExtensionContext) => {
    safeStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    try {
      const revoked = revokeGrants({ scope: "session" });
      for (const grant of revoked) {
        logAudit({ at: Date.now(), credentialId: grant.credentialId, agent: grant.agent, event: "revoked", target: grant.target, result: `session grant ${grant.grantId} ended with session` });
      }
      cleanupTempFiles();
    } catch {
      // Shutdown cleanup is best-effort.
    } finally {
      clearKeyCache();
    }
  });
}

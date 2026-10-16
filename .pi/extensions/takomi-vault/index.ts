import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { cleanupTempFiles } from "./adapters.ts";
import { clearKeyCache, peekBackend } from "./crypto-store.ts";
import { revokeExpiredSessionGrants } from "./grant-store.ts";
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
      cleanupTempFiles();
    } catch {
      // Shutdown cleanup is best-effort.
    } finally {
      clearKeyCache();
    }
  });
}

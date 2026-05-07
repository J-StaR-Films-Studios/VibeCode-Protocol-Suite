import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerRouterCommands, formatStatusReport } from "./commands.ts";
import { registerRouterProvider, RouterRuntime } from "./provider.ts";

function updateFooter(pi: ExtensionAPI, runtime: RouterRuntime, notify = false) {
  pi.on("session_start", async (_event, ctx) => {
    const rows = runtime.getStatusRows();
    const healthy = rows.filter((row) => {
      if (!row.enabled) return false;
      if (row.authHealth !== "ok") return false;
      if (row.cooldownUntil && row.cooldownUntil > Date.now()) return false;
      if (row.penaltyUntil && row.penaltyUntil > Date.now()) return false;
      return true;
    }).length;

    ctx.ui.setStatus("oauth-router", `oauth-router ${healthy}/${rows.length || 0} healthy | ${runtime.getPolicy()}`);
    if (notify) {
      ctx.ui.notify("oauth-router loaded", "info");
    }
  });
}

export default function (pi: ExtensionAPI) {
  const runtime = new RouterRuntime();

  registerRouterProvider(pi, runtime);
  registerRouterCommands(pi, runtime);
  updateFooter(pi, runtime, false);

  pi.registerCommand("router-debug-report", {
    description: "Emit a detailed oauth-router report",
    handler: async () => {
      pi.sendMessage({
        customType: "oauth-router",
        content: formatStatusReport(runtime),
        display: true,
        details: { source: "oauth-router", debug: true },
      });
    },
  });
}

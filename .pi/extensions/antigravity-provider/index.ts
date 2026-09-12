import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolveAntigravityBinary } from "./binary.ts";
import { registerAntigravityProvider, AntigravityProviderRuntime } from "./provider.ts";
import type { AntigravityBinaryLinkConfig } from "./types.ts";
import { installAntigravityUiBridge } from "./ui.ts";

function loadBinaryLinkConfig(): AntigravityBinaryLinkConfig {
  // Optional repo-local link file (.pi/antigravity.json); env vars are read
  // inside the resolver. Best-effort: missing/unparseable file = no link.
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const raw = fs.readFileSync(path.join(here, "..", "..", "antigravity.json"), "utf8");
    const parsed = JSON.parse(raw) as AntigravityBinaryLinkConfig;
    return {
      ...(parsed.binaryPath ? { binaryPath: parsed.binaryPath } : {}),
      ...(parsed.harnessPath ? { harnessPath: parsed.harnessPath } : {}),
    };
  } catch {
    return {};
  }
}

export default function (pi: ExtensionAPI) {
  const linkConfig = loadBinaryLinkConfig();
  const runtime = new AntigravityProviderRuntime(linkConfig);

  registerAntigravityProvider(pi, runtime);
  installAntigravityUiBridge(pi, runtime);

  // Lazy catalog refresh. Never spawn the ACP server during boot: Pi awaits
  // session_start handlers, and initialize + authenticate + session/new on a
  // ~560MB server is what made startup feel stuck. The persisted/fallback
  // catalog serves the picker instantly; the live list fills in afterwards
  // and re-registers the provider (takes effect, no /reload needed).
  const scheduleBackgroundRefresh = () => {
    runtime.refreshCatalogInBackground(() => {
      try {
        registerAntigravityProvider(pi, runtime);
      } catch {
        // Re-registration is best-effort; the old list keeps working.
      }
    });
  };
  pi.on("session_start", () => {
    // Fire-and-forget on purpose: do not await, do not block boot.
    setTimeout(scheduleBackgroundRefresh, 1500).unref?.();
  });

  pi.registerCommand("antigravity-status", {
    description: "Show status of the Google Antigravity Pi model provider",
    handler: async (_args, ctx) => {
      const models = runtime.getModels().map((m) => m.id).join("\n- ");
      const binary = resolveAntigravityBinary(linkConfig);
      const status =
        `Google Antigravity Extension Active.\n` +
        `Server: ${binary.source}${binary.version ? ` (${binary.version})` : ""}\n` +
        `${binary.detail}\n` +
        `Models:\n- ${models}`;
      if (ctx.hasUI) {
        ctx.ui.notify(status, binary.source === "missing" ? "error" : "info");
      }
    },
  });
}

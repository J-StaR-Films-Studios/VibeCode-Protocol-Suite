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
  // The persisted catalog serves the picker without starting ACP. Refresh it
  // from the first Antigravity session, then update the picker in place.
  const runtime = new AntigravityProviderRuntime(linkConfig, undefined, () => {
    try {
      registerAntigravityProvider(pi, runtime);
    } catch {
      // Re-registration is best-effort; the old list keeps working.
    }
  });

  registerAntigravityProvider(pi, runtime);
  installAntigravityUiBridge(pi, runtime);

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

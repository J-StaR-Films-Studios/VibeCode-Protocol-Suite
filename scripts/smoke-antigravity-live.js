import { AcpClient } from "../.pi/extensions/antigravity-provider/acp-client.ts";
import { AcpSessionManager } from "../.pi/extensions/antigravity-provider/acp-session.ts";
import { toCatalogEntries } from "../.pi/extensions/antigravity-provider/catalog.ts";

// One-off live smoke test (NOT in regressions: needs the real server + login).
// Usage: node scripts/smoke-antigravity-live.js [--prompt]
const doPrompt = process.argv.includes("--prompt");

const manager = new AcpSessionManager({}, process.cwd());
try {
  const { session, release } = await manager.acquireMain();
  console.log("sessionId:", session.sessionId);
  console.log("modelConfigId:", session.modelConfigId);
  console.log("currentModel:", session.currentModel);
  const entries = toCatalogEntries(session);
  console.log(`catalog: ${entries.length} models`);
  for (const e of entries.slice(0, 15)) console.log(" -", e.id, "|", e.name);
  if (entries.length > 15) console.log(` ... and ${entries.length - 15} more`);
  release();

  if (doPrompt) {
    const claimed = await manager.acquireMain();
    const texts = [];
    const off = manager.onText((sid, text) => {
      if (sid === claimed.session.sessionId) texts.push(text);
    });
    const stop = await manager.prompt(
      claimed.session,
      "Do not use tools. Return exactly AGY_OK and nothing else.",
    );
    off();
    claimed.release();
    console.log("stopReason:", stop);
    console.log("text:", JSON.stringify(texts.join("")));
  }
  console.log("SMOKE OK");
  process.exit(0);
} catch (error) {
  console.error("SMOKE FAIL:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  manager.shutdown();
}

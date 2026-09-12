import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveAntigravityBinary, takomiManagedDir } from "../.pi/extensions/antigravity-provider/binary.ts";

console.log("🧪 Running Antigravity Binary Resolver Tests...");

// Test 1: On this machine the T3-managed runtime must resolve (read-only reuse).
{
  const res = resolveAntigravityBinary();
  assert.strictEqual(res.source, "t3-managed", `Expected t3-managed, got ${res.source}: ${res.detail}`);
  assert.ok(res.executablePath?.endsWith("agy_acp_server.exe"), "Should resolve the server exe");
  assert.ok(res.harnessPath?.endsWith("localharness_external.exe"), "Should resolve the sibling harness");
  assert.ok(res.executablePath && fs.existsSync(res.executablePath), "Server exe must exist");
  assert.ok(res.harnessPath && fs.existsSync(res.harnessPath), "Harness exe must exist");
  assert.strictEqual(res.version, "agy_acp_server_1.1.1", "Should read version from .install-complete.json");
  console.log(`✅ Test 1 Passed: T3-managed reuse (${res.executablePath})`);
}

// Test 2: Explicit link wins over managed, harness defaults to sibling.
{
  const linked = resolveAntigravityBinary().executablePath;
  assert.ok(linked);
  const res = resolveAntigravityBinary({ binaryPath: linked });
  assert.strictEqual(res.source, "linked", `Expected linked, got ${res.source}`);
  assert.strictEqual(res.executablePath, linked);
  assert.ok(res.harnessPath && fs.existsSync(res.harnessPath), "Sibling harness must resolve");
  console.log("✅ Test 2 Passed: explicit link + sibling harness");
}

// Test 3: Explicit link to a missing file reports missing (never falls through silently).
{
  const res = resolveAntigravityBinary({ binaryPath: path.join(os.tmpdir(), "no-such-agy.exe") });
  assert.strictEqual(res.source, "missing");
  assert.ok(res.detail.includes("not found"));
  console.log("✅ Test 3 Passed: missing link is explicit");
}

// Test 4: Linked server without a harness reports missing with guidance.
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-link-"));
  const fake = path.join(dir, "agy_acp_server.exe");
  fs.writeFileSync(fake, "fake");
  const res = resolveAntigravityBinary({ binaryPath: fake });
  assert.strictEqual(res.source, "missing");
  assert.ok(res.detail.includes("harness"), "Should point at the missing harness helper");
  fs.rmSync(dir, { recursive: true, force: true });
  console.log("✅ Test 4 Passed: harness validation on linked servers");
}

// Test 5: Takomi-managed dir mirrors T3 layout and never points into ~/.gemini.
{
  const dir = takomiManagedDir();
  assert.ok(!dir.includes(".gemini"), "Takomi tool installs must not live in ~/.gemini");
  assert.ok(dir.includes("antigravity-acp"), "Should mirror the T3 tools layout");
  console.log(`✅ Test 5 Passed: takomi-managed root is ${dir}`);
}

console.log("🎉 All Antigravity Binary Resolver Tests Passed!");

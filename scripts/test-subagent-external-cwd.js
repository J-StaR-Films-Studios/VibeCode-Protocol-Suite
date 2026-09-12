#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-external-cwd-"));
const workspace = path.join(fixtureRoot, "workspace");
const internalDir = path.join(workspace, "internal");
const externalDir = path.join(fixtureRoot, "external");
const externalChild = path.join(externalDir, "child");
const regularFile = path.join(fixtureRoot, "file.txt");

const dataModule = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function transpile(filePath, replacements = {}) {
  let javascript = ts.transpileModule(await fs.readFile(filePath, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) {
    javascript = javascript.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
  }
  return dataModule(javascript);
}

await fs.mkdir(internalDir, { recursive: true });
await fs.mkdir(externalChild, { recursive: true });
await fs.writeFile(regularFile, "not a directory", "utf8");

const state = {
  baseCwd: workspace,
  currentSessionId: "external-cwd-test",
  subagentInProgress: false,
  asyncJobs: new Map(),
  foregroundRuns: new Map(),
  foregroundControls: new Map(),
  lastForegroundControlId: null,
  pendingForegroundControlNotices: new Map(),
  cleanupTimers: new Map(),
  lastUiContext: null,
  poller: null,
  completionSeen: new Map(),
  watcher: null,
  watcherRestartTimer: null,
  resultFileCoalescer: { schedule: () => false, clear() {} },
};

const publicAgents = ["architect", "designer", "coder", "worker", "reviewer", "orchestrator"];
const internalsUrl = dataModule(`
  export async function loadPiSubagentsInternals() {
    return {
      TEMP_ARTIFACTS_DIR: ${JSON.stringify(path.join(fixtureRoot, "artifacts"))},
      discoverPiAgents: () => ({ agents: ${JSON.stringify(publicAgents.map((name) => ({ name })))} }),
      createSubagentExecutor() {
        return { async execute(_id, params) {
          globalThis.__takomiExternalCwdCalls.push(params);
          return { content: [{ type: "text", text: "ok" }], details: { mode: params.action ? "action" : "single", results: [] } };
        } };
      },
    };
  }
`);
const lifecycleUrl = dataModule(`
  const state = globalThis.__takomiExternalCwdState;
  export async function ensureTakomiAsyncLifecycle() { return { state, generation: 1, ownership: "takomi" }; }
  export function getTakomiAsyncLifecycleSnapshot() { return { state, generation: 1, ownership: "takomi" }; }
`);
const aliasesUrl = dataModule(`export function resolveAgentName(name) { return name; }`);
const routingUrl = dataModule(`
  export function applyTakomiRoutingDefaults(value) { return value; }
  export function loadTakomiModelRoutingSnapshotSync() { return {}; }
`);
const agentsUrl = dataModule(`export const TAKOMI_PUBLIC_AGENT_NAMES = ${JSON.stringify(publicAgents)};`);

globalThis.__takomiExternalCwdState = state;
globalThis.__takomiExternalCwdCalls = [];

const engineUrl = await transpile(path.join(extensionDir, "pi-subagents-engine.ts"), {
  "./pi-subagents-internal": internalsUrl,
  "./async-lifecycle": lifecycleUrl,
  "./agent-aliases": aliasesUrl,
  "../takomi-runtime/model-routing-defaults": routingUrl,
  "./agents": agentsUrl,
});
const delegationPlanUrl = await transpile(path.join(extensionDir, "delegation-plan.ts"));
const [{ createTakomiPiSubagentsEngine }, { createTakomiDelegationPlan, renderTakomiDelegationPlan }] = await Promise.all([
  import(engineUrl),
  import(delegationPlanUrl),
]);

const ctx = {
  cwd: workspace,
  model: undefined,
  modelRegistry: { getAvailable: () => [] },
  sessionManager: { getSessionFile: () => null, getSessionId: () => "external-cwd-test" },
};
const engine = createTakomiPiSubagentsEngine({});
const canonicalWorkspace = await fs.realpath(workspace);
const canonicalInternal = await fs.realpath(internalDir);
const canonicalExternal = await fs.realpath(externalDir);
const canonicalExternalChild = await fs.realpath(externalChild);

async function capture(params) {
  const calls = globalThis.__takomiExternalCwdCalls;
  const before = calls.length;
  await engine.execute("external-cwd", params, undefined, undefined, ctx);
  assert.equal(calls.length, before + 1, "production adapter reaches the native executor exactly once");
  return calls.at(-1);
}

async function rejects(params, pattern) {
  const calls = globalThis.__takomiExternalCwdCalls;
  const before = calls.length;
  await assert.rejects(engine.execute("external-cwd", params, undefined, undefined, ctx), pattern);
  assert.equal(calls.length, before, "invalid cwd never reaches the native executor");
}

try {
  const inherited = await capture({ agent: "worker", task: "Inspect the current project." });
  assert.equal(inherited.cwd, canonicalWorkspace, "omitted cwd inherits and canonicalizes the parent workspace");

  const contained = await capture({ agent: "worker", task: "Inspect the internal directory.", cwd: "internal" });
  assert.equal(contained.cwd, canonicalInternal, "contained relative cwd resolves beneath the parent workspace");

  for (const agent of publicAgents) {
    const external = await capture({ agent, task: `Run ${agent} in the external project.`, cwd: externalDir });
    assert.equal(external.cwd, canonicalExternal, `${agent} accepts an explicit external absolute cwd`);
  }

  const parallel = await capture({
    cwd: workspace,
    tasks: [
      { agent: "worker", task: "Inherited task" },
      { agent: "coder", task: "Contained task", cwd: "internal", model: "openai-codex/gpt-5.6-sol" },
      { agent: "reviewer", task: "External task", cwd: externalDir },
    ],
    concurrency: 3,
  });
  assert.equal(parallel.cwd, canonicalWorkspace);
  assert.deepEqual(parallel.tasks.map((task) => task.cwd), [canonicalWorkspace, canonicalInternal, canonicalExternal]);
  assert.deepEqual(parallel.tasks.map((task) => task.agent), ["worker", "coder", "reviewer"], "parallel task order is preserved");
  assert.equal(parallel.tasks[1].model, "openai-codex/gpt-5.6-sol", "cwd mapping preserves other task fields");

  const externalRootParallel = await capture({
    cwd: externalDir,
    tasks: [
      { agent: "worker", task: "External root" },
      { agent: "coder", task: "External child", cwd: "child" },
    ],
  });
  assert.equal(externalRootParallel.cwd, canonicalExternal);
  assert.deepEqual(externalRootParallel.tasks.map((task) => task.cwd), [canonicalExternal, canonicalExternalChild], "relative task cwd uses the selected external root");

  const chain = await capture({
    cwd: workspace,
    chain: [
      { agent: "worker", task: "First" },
      { agent: "coder", task: "Second after {previous}", cwd: "internal" },
      { agent: "reviewer", task: "Third after {previous}", cwd: externalDir },
    ],
  });
  assert.deepEqual(chain.chain.map((task) => task.cwd), [canonicalWorkspace, canonicalInternal, canonicalExternal]);
  assert.match(chain.chain[1].task, /\{previous\}/, "chain handoff marker is preserved");

  const asyncExternal = await capture({ agent: "worker", task: "Run later.", cwd: externalDir, async: true });
  assert.equal(asyncExternal.cwd, canonicalExternal);
  assert.equal(asyncExternal.async, true, "async mapping preserves external cwd");

  const worktreeExternal = await capture({ agent: "worker", task: "Use a worktree.", cwd: externalDir, worktree: true });
  assert.equal(worktreeExternal.cwd, canonicalExternal);
  assert.equal(worktreeExternal.worktree, true, "worktree mapping preserves external root for native validation");

  const managementExternal = await capture({ action: "status", id: "run-1", cwd: externalDir });
  assert.equal(managementExternal.cwd, canonicalExternal);
  assert.equal(managementExternal.action, "status", "management actions accept an external cwd");

  await rejects(
    { agent: "worker", task: "Escape relatively.", cwd: "../external" },
    /escapes the current workspace; use an explicit absolute cwd for an external target/i,
  );
  await rejects(
    { agent: "worker", task: "Missing target.", cwd: path.join(fixtureRoot, "missing") },
    /must be an existing directory/i,
  );
  await rejects(
    { agent: "worker", task: "File target.", cwd: regularFile },
    /must be an existing directory/i,
  );

  let linksAvailable = true;
  const externalLink = path.join(workspace, "external-link");
  const internalLink = path.join(workspace, "internal-link");
  try {
    const linkType = process.platform === "win32" ? "junction" : "dir";
    await fs.symlink(externalDir, externalLink, linkType);
    await fs.symlink(internalDir, internalLink, linkType);
  } catch (error) {
    linksAvailable = false;
    console.warn(`- link-specific cwd cases skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (linksAvailable) {
    await rejects(
      { agent: "worker", task: "Relative link escape.", cwd: "external-link" },
      /escapes the current workspace; use an explicit absolute cwd for an external target/i,
    );
    const absoluteLink = await capture({ agent: "worker", task: "Explicit external link.", cwd: externalLink });
    assert.equal(absoluteLink.cwd, canonicalExternal, "explicit absolute external link resolves to its canonical target");
    const relativeInternalLink = await capture({ agent: "worker", task: "Contained link.", cwd: "internal-link" });
    assert.equal(relativeInternalLink.cwd, canonicalInternal, "contained relative link resolves to its canonical target");
  }

  const plan = createTakomiDelegationPlan({
    source: "takomi-tool",
    launchMode: "manual",
    profile: { version: 1, autoOrchestrate: true },
    tasks: [{ agent: "worker", task: "Inspect the external project.", cwd: canonicalExternal }],
  });
  assert.equal(plan.tasks[0].cwd, canonicalExternal, "delegation plan stores canonical cwd");
  assert.match(renderTakomiDelegationPlan(plan), new RegExp(`cwd=${canonicalExternal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "rendered delegation plan exposes canonical cwd");

  const toolSource = await fs.readFile(path.join(extensionDir, "index.ts"), "utf8");
  assert.match(toolSource, /Omit cwd only when the intended project is the current\/default project/i);
  assert.match(toolSource, /task prose never changes cwd/i);
  assert.match(toolSource, /explicit absolute cwd outside the parent workspace/i);

  console.log("✓ external cwd production mapping, safeguards, previews, and tool guidance passed");
} finally {
  engine.dispose();
  delete globalThis.__takomiExternalCwdCalls;
  delete globalThis.__takomiExternalCwdState;
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

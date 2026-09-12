#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";

// Regression test for the single-mode cwd contract: the delegation plan must
// show the resolved canonical task cwd AND the native engine must receive that
// same cwd (not the parent workspace root) when launching.
const repoRoot = path.resolve(import.meta.dirname, "..");
const extensionDir = path.join(repoRoot, ".pi", "extensions", "takomi-subagents");
const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "takomi-single-cwd-"));
const workspace = path.join(fixtureRoot, "workspace");
const externalDir = path.join(fixtureRoot, "external");
await fs.mkdir(workspace, { recursive: true });
await fs.mkdir(externalDir, { recursive: true });

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

globalThis.__takomiSingleCwdCalls = [];
const workerAgent = {
  name: "worker",
  description: "test worker",
  source: "user",
  tools: [],
  filePath: path.join(fixtureRoot, "worker.md"),
  defaultContext: "fresh",
};
const stubs = {
  "../takomi-runtime/profile": dataModule(
    `export async function loadTakomiProfile() { return { version: 1, launchMode: "auto", autoOrchestrate: true }; }`,
  ),
  "../takomi-runtime/gate-provenance": dataModule(
    `export function hasUserGateAutoProvenance() { return false; }`,
  ),
  "../takomi-runtime/model-routing-defaults": dataModule(`
    export function applyTakomiRoutingDefaults(value) { return value; }
    export function isTakomiModelApproved() { return true; }
    export async function loadTakomiModelRoutingSnapshot() { return { approvedModels: [] }; }
    export function stripThinkingSuffix(model) { return { baseModel: model }; }
  `),
  "./agent-aliases": dataModule(`export function resolveAgentName(name) { return name; }`),
  "./agents": dataModule(
    `export const TAKOMI_PUBLIC_AGENT_NAMES = ["worker"];
     export function discoverTakomiAgents() { return [${JSON.stringify(workerAgent)}]; }`,
  ),
  "./detached-results": dataModule(`
    export async function rememberDetachedLaunch() {}
    export async function resolveDetachedStatusResult(pi, params, result) { return result; }
  `),
  "./pi-subagents-engine": dataModule(`
    export function createTakomiPiSubagentsEngine() {
      return { async execute(_id, params) {
        globalThis.__takomiSingleCwdCalls.push(structuredClone(params));
        return { content: [{ type: "text", text: "ok" }], details: { results: [] } };
      }, dispose() {} };
    }
  `),
  "./subagent-ux": dataModule(`
    export function createTakomiUxTasks() { return []; }
    export function withTakomiUxDetails(details) { return details ?? {}; }
  `),
};

const delegationPlanUrl = await transpile(path.join(extensionDir, "delegation-plan.ts"));
const runnerUrl = await transpile(path.join(extensionDir, "tool-runner.ts"), {
  ...stubs,
  "./delegation-plan": delegationPlanUrl,
});
const { executeTakomiSubagentTool } = await import(runnerUrl);

const pi = {};
const ctx = {
  cwd: workspace,
  hasUI: false,
  sessionManager: { getEntries: () => [], getSessionId: () => "single-cwd-test" },
  modelRegistry: { getAvailable: () => [] },
};
const canonicalWorkspace = await fs.realpath(workspace);
const canonicalExternal = await fs.realpath(externalDir);

try {
  const calls = globalThis.__takomiSingleCwdCalls;

  const inherited = await executeTakomiSubagentTool(pi, { agent: "worker", task: "Look around." }, undefined, undefined, ctx);
  assert.equal(calls.at(-1).cwd, canonicalWorkspace, "inherited single launch runs at the workspace root");
  assert.equal(
    inherited.details.takomi.plan.tasks[0].cwd,
    calls.at(-1).cwd,
    "plan cwd and executed cwd agree without explicit cwd",
  );

  const external = await executeTakomiSubagentTool(
    pi,
    { agent: "worker", task: "Work over there.", cwd: externalDir },
    undefined,
    undefined,
    ctx,
  );
  assert.equal(calls.at(-1).cwd, canonicalExternal, "explicit external cwd reaches native execution");
  assert.equal(
    external.details.takomi.plan.tasks[0].cwd,
    calls.at(-1).cwd,
    "plan cwd and executed cwd agree with explicit external cwd",
  );

  console.log("✓ single-mode cwd reaches native execution and matches the plan");
} finally {
  delete globalThis.__takomiSingleCwdCalls;
  await fs.rm(fixtureRoot, { recursive: true, force: true });
}

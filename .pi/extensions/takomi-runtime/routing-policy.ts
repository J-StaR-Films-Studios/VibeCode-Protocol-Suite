import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const TAKOMI_ROUTING_POLICY_RELATIVE = path.join(".pi", "takomi", "model-routing.md");
export const GLOBAL_TAKOMI_ROUTING_POLICY_PATH = path.join(os.homedir(), ".pi", "takomi", "model-routing.md");
export const GLOBAL_PI_SETTINGS_PATH = path.join(os.homedir(), ".pi", "agent", "settings.json");
export const PROJECT_PI_SETTINGS_RELATIVE = path.join(".pi", "settings.json");
export const BUNDLED_TAKOMI_ROUTING_POLICY_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "takomi",
  "model-routing.md",
);

export type RoutingPolicyInstallResult = {
  policyPath: string;
  settingsPath: string;
  settingsUpdated: boolean;
  detectedDefaults: string[];
};

export type RoutingPolicyInstallScope = "global" | "project";
export type RoutingPolicySource = "project" | "global" | "bundled" | "missing";

export type ResolvedRoutingPolicy = {
  source: RoutingPolicySource;
  policyPath?: string;
  text?: string;
};

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

async function readJsonObject(filePath: string): Promise<JsonObject> {
  try {
    return asObject(JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    return {};
  }
}

async function readPolicyText(filePath: string): Promise<string | undefined> {
  try {
    const text = (await readFile(filePath, "utf8")).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function extractQuotedPolicy(text: string): string {
  const triple = text.match(/"""([\s\S]*?)"""|```(?:\w+)?\s*([\s\S]*?)```/);
  const raw = (triple?.[1] ?? triple?.[2] ?? text).trim();
  return raw.replace(/^update\s+(?:takomi\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?/i, "").trim();
}

function normalizeForSettings(filePath: string): string {
  return filePath.replaceAll(path.sep, "/");
}

function deriveSubagentDefaults(policy: string): { overrides: JsonObject; detected: string[] } {
  const lower = policy.toLowerCase();
  const has55 = /gpt[- ]?5\.5/.test(lower);
  const has54 = /gpt[- ]?5\.4(?!\s*mini)/.test(lower);
  const hasMini = /gpt[- ]?5\.4\s*mini/.test(lower);
  if (!has55 && !has54 && !hasMini) return { overrides: {}, detected: [] };

  const model55 = "oauth-router/gpt-5.5";
  const model54 = "oauth-router/gpt-5.4";
  const modelMini = "oauth-router/gpt-5.4-mini";
  const overrides: JsonObject = {};
  const detected: string[] = [];

  if (has55) {
    overrides.oracle = { model: model55, thinking: "high" };
    overrides.reviewer = { model: model55, thinking: "high" };
    overrides.planner = { model: model55, thinking: "medium" };
    detected.push("oracle/reviewer → GPT-5.5 high", "planner → GPT-5.5 medium");
  }
  if (has54) {
    overrides.worker = { model: model54, thinking: "high", fallbackModels: has55 ? [`${model55}:low`] : undefined };
    overrides.contextBuilder = { model: model54, thinking: "high" };
    overrides["context-builder"] = { model: model54, thinking: "high" };
    detected.push("worker/context-builder → GPT-5.4 high");
  }
  if (hasMini) {
    overrides.scout = { model: modelMini, thinking: "high" };
    overrides.delegate = { model: modelMini, thinking: "high" };
    detected.push("scout/delegate → GPT-5.4 Mini high");
  }
  return { overrides, detected };
}

export async function resolveTakomiRoutingPolicy(cwd: string): Promise<ResolvedRoutingPolicy> {
  const projectSettingsPath = path.join(cwd, PROJECT_PI_SETTINGS_RELATIVE);
  const projectSettings = await readJsonObject(projectSettingsPath);
  const projectTakomi = asObject(projectSettings.takomi);
  const configuredProject = typeof projectTakomi.modelRoutingPolicyFile === "string"
    ? projectTakomi.modelRoutingPolicyFile
    : TAKOMI_ROUTING_POLICY_RELATIVE;
  const configuredProjectPath = path.isAbsolute(configuredProject) ? configuredProject : path.join(cwd, configuredProject);
  const configuredProjectText = await readPolicyText(configuredProjectPath);
  if (configuredProjectText) {
    return { source: "project", policyPath: configuredProjectPath, text: configuredProjectText };
  }

  const defaultProjectPath = path.join(cwd, TAKOMI_ROUTING_POLICY_RELATIVE);
  if (path.resolve(defaultProjectPath) !== path.resolve(configuredProjectPath)) {
    const defaultProjectText = await readPolicyText(defaultProjectPath);
    if (defaultProjectText) {
      return { source: "project", policyPath: defaultProjectPath, text: defaultProjectText };
    }
  }

  const globalSettings = await readJsonObject(GLOBAL_PI_SETTINGS_PATH);
  const globalTakomi = asObject(globalSettings.takomi);
  const configuredGlobal = typeof globalTakomi.modelRoutingPolicyFile === "string"
    ? globalTakomi.modelRoutingPolicyFile
    : GLOBAL_TAKOMI_ROUTING_POLICY_PATH;
  const configuredGlobalPath = path.isAbsolute(configuredGlobal) ? configuredGlobal : path.join(os.homedir(), configuredGlobal);
  const configuredGlobalText = await readPolicyText(configuredGlobalPath);
  if (configuredGlobalText) {
    return { source: "global", policyPath: configuredGlobalPath, text: configuredGlobalText };
  }

  if (path.resolve(configuredGlobalPath) !== path.resolve(GLOBAL_TAKOMI_ROUTING_POLICY_PATH)) {
    const globalText = await readPolicyText(GLOBAL_TAKOMI_ROUTING_POLICY_PATH);
    if (globalText) {
      return { source: "global", policyPath: GLOBAL_TAKOMI_ROUTING_POLICY_PATH, text: globalText };
    }
  }

  const bundledText = await readPolicyText(BUNDLED_TAKOMI_ROUTING_POLICY_PATH);
  if (bundledText) {
    return {
      source: "bundled",
      policyPath: BUNDLED_TAKOMI_ROUTING_POLICY_PATH,
      text: bundledText,
    };
  }

  return { source: "missing" };
}

export async function installTakomiRoutingPolicy(cwd: string, input: string, options: { scope?: RoutingPolicyInstallScope } = {}): Promise<RoutingPolicyInstallResult> {
  const policy = extractQuotedPolicy(input);
  if (!policy) throw new Error("No routing policy text found. Paste the policy after /takomi routing or inside triple quotes.");

  const scope = options.scope ?? "global";
  const policyPath = scope === "project"
    ? path.join(cwd, TAKOMI_ROUTING_POLICY_RELATIVE)
    : GLOBAL_TAKOMI_ROUTING_POLICY_PATH;
  const settingsPath = scope === "project"
    ? path.join(cwd, PROJECT_PI_SETTINGS_RELATIVE)
    : GLOBAL_PI_SETTINGS_PATH;
  await mkdir(path.dirname(policyPath), { recursive: true });
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(policyPath, `# Takomi Model Routing Policy\n\n${policy}\n`, "utf8");

  const settings = await readJsonObject(settingsPath);
  const takomi = asObject(settings.takomi);
  takomi.modelRoutingPolicyFile = scope === "project"
    ? normalizeForSettings(TAKOMI_ROUTING_POLICY_RELATIVE)
    : normalizeForSettings(GLOBAL_TAKOMI_ROUTING_POLICY_PATH);
  settings.takomi = takomi;

  const { overrides, detected } = deriveSubagentDefaults(policy);
  if (Object.keys(overrides).length > 0) {
    const subagents = asObject(settings.subagents);
    const existingOverrides = asObject(subagents.agentOverrides);
    subagents.agentOverrides = { ...existingOverrides, ...overrides };
    settings.subagents = subagents;
  }

  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  return { policyPath, settingsPath, settingsUpdated: true, detectedDefaults: detected };
}

export async function loadTakomiRoutingPolicy(cwd: string): Promise<string | undefined> {
  return (await resolveTakomiRoutingPolicy(cwd)).text;
}

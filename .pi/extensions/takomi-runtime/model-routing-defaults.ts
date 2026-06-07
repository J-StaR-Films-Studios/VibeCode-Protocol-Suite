import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BUNDLED_TAKOMI_ROUTING_POLICY_PATH,
  GLOBAL_PI_SETTINGS_PATH,
  GLOBAL_TAKOMI_ROUTING_POLICY_PATH,
  PROJECT_PI_SETTINGS_RELATIVE,
  TAKOMI_ROUTING_POLICY_RELATIVE,
  resolveTakomiRoutingPolicy,
} from "./routing-policy";

export const TAKOMI_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;

type Settings = {
  takomi?: { modelRoutingPolicyFile?: string };
  subagents?: { agentOverrides?: Record<string, unknown> };
};

export type TakomiAgentModelDefault = {
  agent: string;
  model?: string;
  thinking?: string;
  fallbackModels?: string[];
};

export type TakomiModelRoutingSnapshot = {
  approvedModels: string[];
  preferredModels: string[];
  sourceFiles: string[];
  agentDefaults: TakomiAgentModelDefault[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function readSettingsFile(filePath: string): Promise<Settings> {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, "utf8")) as Settings;
  } catch {
    return {};
  }
}

function readSettingsFileSync(filePath: string): Settings {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as Settings;
  } catch {
    return {};
  }
}

function mergeSettings(globalSettings: Settings, projectSettings: Settings): Settings {
  const globalOverrides = asRecord(globalSettings.subagents?.agentOverrides);
  const projectOverrides = asRecord(projectSettings.subagents?.agentOverrides);
  return {
    ...globalSettings,
    ...projectSettings,
    takomi: { ...(globalSettings.takomi ?? {}), ...(projectSettings.takomi ?? {}) },
    subagents: {
      ...(globalSettings.subagents ?? {}),
      ...(projectSettings.subagents ?? {}),
      agentOverrides: { ...globalOverrides, ...projectOverrides },
    },
  };
}

async function readSettings(cwd: string): Promise<Settings> {
  const globalSettings = await readSettingsFile(path.join(os.homedir(), ".pi", "agent", "settings.json"));
  const projectSettings = await readSettingsFile(path.resolve(cwd, ".pi/settings.json"));
  return mergeSettings(globalSettings, projectSettings);
}

function readSettingsSync(cwd: string): Settings {
  const globalSettings = readSettingsFileSync(path.join(os.homedir(), ".pi", "agent", "settings.json"));
  const projectSettings = readSettingsFileSync(path.resolve(cwd, ".pi/settings.json"));
  return mergeSettings(globalSettings, projectSettings);
}

function collectAgentDefaultsFromSettings(settings: Settings): TakomiAgentModelDefault[] {
  const overrides = asRecord(settings.subagents?.agentOverrides);
  const defaults: TakomiAgentModelDefault[] = [];
  for (const [agent, value] of Object.entries(overrides)) {
    const record = asRecord(value);
    const fallbackModels = Array.isArray(record.fallbackModels)
      ? record.fallbackModels.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : undefined;
    defaults.push({
      agent,
      model: typeof record.model === "string" ? record.model : undefined,
      thinking: typeof record.thinking === "string" ? record.thinking : undefined,
      fallbackModels,
    });
  }
  return defaults;
}

function collectModelsFromDefaults(defaults: TakomiAgentModelDefault[]): string[] {
  const models: string[] = [];
  for (const record of defaults) {
    if (record.model) models.push(stripThinkingSuffix(record.model).baseModel);
    if (Array.isArray(record.fallbackModels)) {
      for (const fallback of record.fallbackModels) models.push(stripThinkingSuffix(fallback).baseModel);
    }
  }
  return models;
}

function isModelLike(value: string): boolean {
  const lower = value.toLowerCase();
  return /(^|\/)(gpt|claude|gemini|o[0-9]|qwen|deepseek|llama|mistral|kimi|grok|sonnet|haiku|opus|codex|mini|max)/i.test(lower)
    || lower.includes("oauth-router/")
    || lower.includes("openai-codex/")
    || lower.includes("lmstudio/");
}

function collectModelsFromPolicy(text: string): string[] {
  // Provider-agnostic policy text like "GPT-5.5" expresses routing intent, not
  // a concrete provider. Only provider-qualified IDs belong in the executable
  // approved-model set; otherwise users without oauth-router would inherit a
  // provider they never configured.
  const explicit = (text.match(/[a-z0-9-]+\/[a-z0-9._-]+/gi) ?? []).filter(isModelLike);
  return unique(explicit.map((model) => stripThinkingSuffix(model).baseModel));
}

function readPolicyTextSync(filePath: string): string | undefined {
  try {
    const text = fs.readFileSync(filePath, "utf8").trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function resolvePolicySync(cwd: string): { policyPath?: string; text?: string } {
  const projectSettings = readSettingsFileSync(path.join(cwd, PROJECT_PI_SETTINGS_RELATIVE));
  const projectTakomi = asRecord(projectSettings.takomi);
  const configuredProject = typeof projectTakomi.modelRoutingPolicyFile === "string"
    ? projectTakomi.modelRoutingPolicyFile
    : TAKOMI_ROUTING_POLICY_RELATIVE;
  const configuredProjectPath = path.isAbsolute(configuredProject) ? configuredProject : path.join(cwd, configuredProject);
  const configuredProjectText = readPolicyTextSync(configuredProjectPath);
  if (configuredProjectText) return { policyPath: configuredProjectPath, text: configuredProjectText };

  const defaultProjectPath = path.join(cwd, TAKOMI_ROUTING_POLICY_RELATIVE);
  if (path.resolve(defaultProjectPath) !== path.resolve(configuredProjectPath)) {
    const defaultProjectText = readPolicyTextSync(defaultProjectPath);
    if (defaultProjectText) return { policyPath: defaultProjectPath, text: defaultProjectText };
  }

  const globalSettings = readSettingsFileSync(GLOBAL_PI_SETTINGS_PATH);
  const globalTakomi = asRecord(globalSettings.takomi);
  const configuredGlobal = typeof globalTakomi.modelRoutingPolicyFile === "string"
    ? globalTakomi.modelRoutingPolicyFile
    : GLOBAL_TAKOMI_ROUTING_POLICY_PATH;
  const configuredGlobalPath = path.isAbsolute(configuredGlobal) ? configuredGlobal : path.join(os.homedir(), configuredGlobal);
  const configuredGlobalText = readPolicyTextSync(configuredGlobalPath);
  if (configuredGlobalText) return { policyPath: configuredGlobalPath, text: configuredGlobalText };

  if (path.resolve(configuredGlobalPath) !== path.resolve(GLOBAL_TAKOMI_ROUTING_POLICY_PATH)) {
    const globalText = readPolicyTextSync(GLOBAL_TAKOMI_ROUTING_POLICY_PATH);
    if (globalText) return { policyPath: GLOBAL_TAKOMI_ROUTING_POLICY_PATH, text: globalText };
  }

  const bundledText = readPolicyTextSync(BUNDLED_TAKOMI_ROUTING_POLICY_PATH);
  return bundledText ? { policyPath: BUNDLED_TAKOMI_ROUTING_POLICY_PATH, text: bundledText } : {};
}

export function stripThinkingSuffix(model: string): { baseModel: string; thinkingSuffix: string } {
  const colonIdx = model.lastIndexOf(":");
  if (colonIdx === -1) return { baseModel: model, thinkingSuffix: "" };
  const suffix = model.slice(colonIdx + 1).toLowerCase();
  if (!(TAKOMI_THINKING_LEVELS as readonly string[]).includes(suffix)) return { baseModel: model, thinkingSuffix: "" };
  return { baseModel: model.slice(0, colonIdx), thinkingSuffix: `:${suffix}` };
}

export function modelFamily(model: string): string {
  const baseModel = stripThinkingSuffix(model).baseModel;
  return baseModel.split("/").at(-1)?.toLowerCase() ?? baseModel.toLowerCase();
}

export function isTakomiModelApproved(requested: string, approved: string[]): boolean {
  const requestedBase = stripThinkingSuffix(requested).baseModel;
  return approved.some((candidate) => stripThinkingSuffix(candidate).baseModel === requestedBase);
}

export function approvedModelEquivalent(requested: string, approved: string[]): string | undefined {
  const { thinkingSuffix } = stripThinkingSuffix(requested);
  const requestedFamily = modelFamily(requested);
  const equivalent = approved.find((candidate) => modelFamily(candidate) === requestedFamily);
  return equivalent ? `${stripThinkingSuffix(equivalent).baseModel}${thinkingSuffix}` : undefined;
}

export function normalizeModelToApproved(requested: string | undefined, approved: string[], fallback?: string): string | undefined {
  if (!requested) return fallback;
  if (isTakomiModelApproved(requested, approved)) return requested;
  return approvedModelEquivalent(requested, approved) ?? fallback ?? requested;
}

function normalizedAgentKey(agent: string): string {
  return agent.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const DEFAULT_ALIAS_KEYS: Record<string, string[]> = {
  architect: ["architect", "planner", "oracle", "worker"],
  orchestrator: ["orchestrator", "planner", "oracle", "worker"],
  planner: ["planner", "oracle", "worker"],
  coder: ["coder", "code", "worker", "delegate"],
  code: ["code", "coder", "worker", "delegate"],
  designer: ["designer", "design", "worker", "delegate"],
  design: ["design", "designer", "worker", "delegate"],
  reviewer: ["reviewer", "review", "oracle"],
  review: ["review", "reviewer", "oracle"],
  general: ["general", "worker"],
};

export function resolveAgentRoutingDefault(snapshot: TakomiModelRoutingSnapshot, agent: string): TakomiAgentModelDefault | undefined {
  const normalized = normalizedAgentKey(agent);
  const candidates = [normalized, ...(DEFAULT_ALIAS_KEYS[normalized] ?? []), "worker"].map(normalizedAgentKey);
  return snapshot.agentDefaults.find((entry) => candidates.includes(normalizedAgentKey(entry.agent)));
}

export function applyTakomiRoutingDefaults<T extends { agent: string; model?: string; fallbackModels?: string[]; thinking?: string }>(
  task: T,
  snapshot: TakomiModelRoutingSnapshot,
): T {
  const defaults = resolveAgentRoutingDefault(snapshot, task.agent);
  if (!snapshot.approvedModels.length && !defaults) return task;
  const approved = snapshot.approvedModels;
  const model = normalizeModelToApproved(task.model, approved, defaults?.model);
  const thinking = task.thinking ?? defaults?.thinking;
  const mergedFallbacks = unique([...(task.fallbackModels ?? []), ...(defaults?.fallbackModels ?? [])]);
  const fallbackModels = unique(mergedFallbacks
    .map((fallback) => normalizeModelToApproved(fallback, approved))
    .filter((fallback): fallback is string => Boolean(fallback))
    .filter((fallback) => !approved.length || isTakomiModelApproved(fallback, approved)));

  return {
    ...task,
    ...(model ? { model } : {}),
    ...(thinking ? { thinking } : {}),
    ...(fallbackModels.length ? { fallbackModels } : {}),
  };
}

export async function loadTakomiModelRoutingSnapshot(cwd: string): Promise<TakomiModelRoutingSnapshot> {
  const settings = await readSettings(cwd);
  const agentDefaults = collectAgentDefaultsFromSettings(settings);
  const settingsModels = collectModelsFromDefaults(agentDefaults);
  const resolvedPolicy = await resolveTakomiRoutingPolicy(cwd);
  const sourceFiles = resolvedPolicy.policyPath ? [resolvedPolicy.policyPath] : [];
  const policyModels = resolvedPolicy.text ? collectModelsFromPolicy(resolvedPolicy.text) : [];
  const approvedModels = unique([...settingsModels, ...policyModels]);
  return { approvedModels, preferredModels: settingsModels.length ? unique(settingsModels) : approvedModels, sourceFiles, agentDefaults };
}

export function loadTakomiModelRoutingSnapshotSync(cwd: string): TakomiModelRoutingSnapshot {
  const settings = readSettingsSync(cwd);
  const agentDefaults = collectAgentDefaultsFromSettings(settings);
  const settingsModels = collectModelsFromDefaults(agentDefaults);
  const resolvedPolicy = resolvePolicySync(cwd);
  const sourceFiles = resolvedPolicy.policyPath ? [resolvedPolicy.policyPath] : [];
  const policyModels = resolvedPolicy.text ? collectModelsFromPolicy(resolvedPolicy.text) : [];
  const approvedModels = unique([...settingsModels, ...policyModels]);
  return { approvedModels, preferredModels: settingsModels.length ? unique(settingsModels) : approvedModels, sourceFiles, agentDefaults };
}

export function renderCompactTakomiModelRoutingSummary(snapshot: TakomiModelRoutingSnapshot): string {
  if (!snapshot.approvedModels.length && !snapshot.agentDefaults.length) return "";
  const defaultLines = snapshot.agentDefaults
    .filter((entry) => entry.model)
    .map((entry) => `- ${entry.agent}: ${entry.model}${entry.thinking ? ` (${entry.thinking})` : ""}${entry.fallbackModels?.length ? `; fallbacks ${entry.fallbackModels.join(", ")}` : ""}`);
  return [
    "Active Takomi subagent routing summary:",
    snapshot.sourceFiles.length ? `Policy source: ${snapshot.sourceFiles.join(", ")}` : "Policy source: settings/defaults",
    snapshot.approvedModels.length ? `Approved model IDs: ${snapshot.approvedModels.join(", ")}` : "Approved model IDs: none discovered",
    "When calling takomi_subagent, omit model to use these defaults or use only the approved provider-qualified IDs above. Do not use openai-codex/* when an oauth-router/* equivalent is approved.",
    defaultLines.length ? "Role defaults:" : "",
    ...defaultLines,
  ].filter(Boolean).join("\n");
}

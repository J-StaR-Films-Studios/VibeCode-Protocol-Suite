import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { ContextManagerState } from "./state";
import { recordBlocked } from "./state";
import { resolveTakomiRoutingPolicy } from "../takomi-runtime/routing-policy";
import { approvedModelEquivalent, isTakomiModelApproved } from "../takomi-runtime/model-routing-defaults";

type Settings = {
  takomi?: { modelRoutingPolicyFile?: string };
  subagents?: { agentOverrides?: Record<string, unknown> };
};

type ModelPolicySnapshot = {
  approvedModels: string[];
  preferredModels: string[];
  sourceFiles: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readSettingsFile(filePath: string): Promise<Settings> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Settings;
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

function modelFamily(model: string): string {
  return model.split("/").at(-1)?.toLowerCase() ?? model.toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function collectModelsFromSettings(settings: Settings): string[] {
  const overrides = asRecord(settings.subagents?.agentOverrides);
  const models: string[] = [];
  for (const value of Object.values(overrides)) {
    const record = asRecord(value);
    if (typeof record.model === "string") models.push(record.model);
    if (Array.isArray(record.fallbackModels)) {
      for (const fallback of record.fallbackModels) if (typeof fallback === "string") models.push(fallback.split(":")[0]);
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
  // Only explicit provider-qualified model IDs are executable policy approvals.
  // Providerless names such as "GPT-5.5" are intent labels, not a provider choice.
  return unique((text.match(/[a-z0-9-]+\/[a-z0-9._-]+/gi) ?? []).filter(isModelLike));
}

async function loadSnapshot(cwd: string): Promise<ModelPolicySnapshot> {
  const settings = await readSettings(cwd);
  const settingsModels = collectModelsFromSettings(settings);
  const resolvedPolicy = await resolveTakomiRoutingPolicy(cwd);
  const sourceFiles = resolvedPolicy.policyPath ? [resolvedPolicy.policyPath] : [];
  const policyModels = resolvedPolicy.text ? collectModelsFromPolicy(resolvedPolicy.text) : [];
  const approvedModels = unique([...settingsModels, ...policyModels]);
  return { approvedModels, preferredModels: settingsModels.length ? unique(settingsModels) : approvedModels, sourceFiles };
}

function collectRequestedModelRefs(input: unknown): Array<{ holder: Record<string, unknown>; key: string; value: string; index?: number }> {
  const refs: Array<{ holder: Record<string, unknown>; key: string; value: string; index?: number }> = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const record = value as Record<string, unknown>;
    for (const key of ["model", "preferredModel"]) {
      if (typeof record[key] === "string") refs.push({ holder: record, key, value: record[key] });
    }
    if (Array.isArray(record.fallbackModels)) {
      const fallbackModels = record.fallbackModels.filter((item): item is string => typeof item === "string");
      record.fallbackModels = fallbackModels;
      fallbackModels.forEach((value: string, index: number) => refs.push({ holder: record, key: "fallbackModels", value, index }));
    }
    for (const key of ["tasks", "chain"]) visit(record[key]);
  }
  visit(input);
  return refs;
}

function setModelRef(ref: { holder: Record<string, unknown>; key: string; value: string; index?: number }, value: string): void {
  if (ref.key === "fallbackModels" && typeof ref.index === "number" && Array.isArray(ref.holder.fallbackModels)) {
    ref.holder.fallbackModels[ref.index] = value;
    return;
  }
  ref.holder[ref.key] = value;
}

function isModelFailure(text: string): boolean {
  return /(unknown provider|provider.*not.*found|model.*not.*found|model.*unavailable|invalid model|unsupported model|auth|unauthorized|forbidden|rate limit|429|quota|context window|maximum context)/i.test(text);
}

function renderPolicyViolation(requested: string, approved: string[]): string {
  return [
    "Blocked by Takomi routing policy.",
    "",
    "Requested model:",
    requested,
    "",
    "Allowed/preferred models include:",
    ...(approved.length ? approved.map((model) => `- ${model}`) : ["- none discovered; run /takomi routing <policy text> first"]),
    "",
    "The subagent did not run. Ask the user how to proceed or retry with an approved model.",
  ].join("\n");
}

type RecoveryChoice =
  | { action: "retry"; model: string }
  | { action: "stop" };

async function askForInvalidModelRecovery(ctx: { ui: { select(title: string, options: string[]): Promise<string | undefined>; notify(message: string, level?: string): void }; abort?: () => void }, requested: string, approved: string[]): Promise<RecoveryChoice> {
  if (approved.length === 0) return { action: "stop" };
  const options = [
    ...approved.map((model) => `Retry with ${model}`),
    "Stop and let me send a new prompt",
  ];
  const choice = await ctx.ui.select(
    `takomi_subagent requested a model outside your routing policy: ${requested}`,
    options,
  );
  if (choice?.startsWith("Retry with ")) return { action: "retry", model: choice.replace("Retry with ", "") };
  return { action: "stop" };
}

export function installModelPolicyGate(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "takomi_subagent") return;
    const snapshot = await loadSnapshot(ctx.cwd);
    const approved = snapshot.approvedModels;
    if (approved.length === 0) return;

    const refs = collectRequestedModelRefs(event.input);
    const corrections: string[] = [];
    for (const ref of refs) {
      if (isTakomiModelApproved(ref.value, approved)) continue;
      const equivalent = approvedModelEquivalent(ref.value, approved);
      if (equivalent) {
        setModelRef(ref, equivalent);
        corrections.push(`${ref.value} -> ${equivalent}`);
        continue;
      }
      const recovery = await askForInvalidModelRecovery(ctx, ref.value, approved);
      if (recovery.action === "retry") {
        setModelRef(ref, recovery.model);
        corrections.push(`${ref.value} -> ${recovery.model} (user selected recovery)`);
        continue;
      }
      const reason = [
        renderPolicyViolation(ref.value, approved),
        "",
        "Human selected stop. The agent turn has been aborted; wait for the user's next prompt.",
      ].join("\n");
      recordBlocked(state, event.toolName, reason);
      ctx.abort?.();
      return { block: true, reason };
    }

    if (corrections.length > 0) {
      ctx.ui.notify(`Takomi context manager corrected subagent model routing:\n- ${corrections.join("\n- ")}\n\nBe careful to follow /takomi routing policy next time.`, "warning");
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (event.toolName !== "takomi_subagent" || !event.isError) return;
    const content = JSON.stringify(event.content ?? "");
    if (!isModelFailure(content)) return;

    const snapshot = await loadSnapshot(ctx.cwd);
    const options = [
      ...snapshot.approvedModels.map((model) => `Retry with ${model}`),
      "Stop and let me send a new prompt",
    ];
    const choice = await ctx.ui.select("Takomi subagent model/provider failure. How do you want to continue?", options);
    const retryModel = choice?.startsWith("Retry with ") ? choice.replace("Retry with ", "") : undefined;
    const stopped = !retryModel;
    const guidance = [
      "Takomi subagent failed with a model/provider-related error.",
      "",
      `Policy source: ${snapshot.sourceFiles.join(", ") || "not found"}`,
      "Policy-approved models:",
      ...(snapshot.approvedModels.length ? snapshot.approvedModels.map((model) => `- ${model}`) : ["- none discovered"]),
      "",
      stopped
        ? "Human selected stop/no retry. The agent turn has been aborted; wait for the user's next prompt."
        : `User selected retry with ${retryModel}. Retry takomi_subagent with model ${retryModel}.`,
    ].join("\n");
    if (stopped) ctx.abort?.();
    return { content: [{ type: "text", text: guidance }], isError: true, terminate: stopped };
  });
}

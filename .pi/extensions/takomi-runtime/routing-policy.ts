import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const TAKOMI_ROUTING_POLICY_RELATIVE = path.join(".pi", "takomi", "model-routing.md");

export type RoutingPolicyInstallResult = {
  policyPath: string;
  settingsPath: string;
  settingsUpdated: boolean;
  detectedDefaults: string[];
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

function extractQuotedPolicy(text: string): string {
  const triple = text.match(/"""([\s\S]*?)"""|```(?:\w+)?\s*([\s\S]*?)```/);
  const raw = (triple?.[1] ?? triple?.[2] ?? text).trim();
  return raw.replace(/^update\s+(?:takomi\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?/i, "").trim();
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

export async function installTakomiRoutingPolicy(cwd: string, input: string): Promise<RoutingPolicyInstallResult> {
  const policy = extractQuotedPolicy(input);
  if (!policy) throw new Error("No routing policy text found. Paste the policy after /takomi routing or inside triple quotes.");

  const policyPath = path.join(cwd, TAKOMI_ROUTING_POLICY_RELATIVE);
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  await mkdir(path.dirname(policyPath), { recursive: true });
  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(policyPath, `# Takomi Model Routing Policy\n\n${policy}\n`, "utf8");

  const settings = await readJsonObject(settingsPath);
  const takomi = asObject(settings.takomi);
  takomi.modelRoutingPolicyFile = TAKOMI_ROUTING_POLICY_RELATIVE.replaceAll(path.sep, "/");
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
  const settingsPath = path.join(cwd, ".pi", "settings.json");
  const settings = await readJsonObject(settingsPath);
  const takomi = asObject(settings.takomi);
  const configured = typeof takomi.modelRoutingPolicyFile === "string" ? takomi.modelRoutingPolicyFile : TAKOMI_ROUTING_POLICY_RELATIVE;
  const policyPath = path.isAbsolute(configured) ? configured : path.join(cwd, configured);
  try {
    const text = (await readFile(policyPath, "utf8")).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

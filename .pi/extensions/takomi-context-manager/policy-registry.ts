import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ContextManagerConfig, PolicyPack } from "./types";
import { normalizeName } from "./skill-registry";

function descriptionFromMarkdown(content: string): string {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstBody = lines.find((line) => !line.startsWith("#"));
  return firstBody?.slice(0, 240) ?? "Policy pack";
}

async function readPolicyFile(name: string, filePath: string): Promise<PolicyPack | undefined> {
  try {
    const content = await readFile(filePath, "utf8");
    return {
      name,
      description: descriptionFromMarkdown(content),
      content,
      path: filePath,
    };
  } catch {
    return undefined;
  }
}

function addPolicy(policies: Map<string, PolicyPack>, policy: PolicyPack | undefined, override = false): void {
  if (!policy) return;
  const key = normalizeName(policy.name);
  if (!override && policies.has(key)) return;
  policies.set(key, policy);
}

async function discoverTakomiSettingsPolicy(cwd: string): Promise<PolicyPack | undefined> {
  try {
    const settingsPath = path.resolve(cwd, ".pi/settings.json");
    const settings = JSON.parse(await readFile(settingsPath, "utf8")) as {
      takomi?: { modelRoutingPolicyFile?: string };
    };
    const modelRoutingPolicyFile = settings.takomi?.modelRoutingPolicyFile;
    if (!modelRoutingPolicyFile) return undefined;
    return readPolicyFile("model-routing", path.resolve(cwd, modelRoutingPolicyFile));
  } catch {
    return undefined;
  }
}

async function discoverExplicitPolicyFiles(cwd: string, config: ContextManagerConfig): Promise<PolicyPack[]> {
  const entries = Object.entries(config.policyFiles ?? {});
  const policies = await Promise.all(entries.map(([name, filePath]) => readPolicyFile(name, path.resolve(cwd, filePath))));
  return policies.filter((policy): policy is PolicyPack => Boolean(policy));
}

export async function discoverPolicies(cwd: string, config: ContextManagerConfig): Promise<Map<string, PolicyPack>> {
  const policies = new Map<string, PolicyPack>();

  // Source-of-truth priority 1: explicit context-manager policy file mappings.
  for (const policy of await discoverExplicitPolicyFiles(cwd, config)) {
    addPolicy(policies, policy, true);
  }

  // Source-of-truth priority 2: Takomi's own routing artifact created by `/takomi routing`.
  // The context manager must consume this file, not invent/own model routing policy text.
  addPolicy(policies, await discoverTakomiSettingsPolicy(cwd), true);

  // Source-of-truth priority 3: discovered markdown policy packs. These are supplemental/default packs.
  for (const policyPath of config.policyPaths) {
    const absolute = path.resolve(cwd, policyPath);
    try {
      const entries = await readdir(absolute, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
        const name = path.basename(entry.name, ".md");
        addPolicy(policies, await readPolicyFile(name, path.join(absolute, entry.name)), false);
      }
    } catch {
      // Optional policy directories may not exist.
    }
  }

  return policies;
}

export function renderPolicyManifest(policies: Map<string, PolicyPack>, names: string[]): string {
  const selected = names.length > 0 ? names : [...policies.keys()];
  return selected.map((name) => {
    const policy = policies.get(normalizeName(name));
    if (!policy) return `Policy not found: ${name}`;
    return [`Policy: ${policy.name}`, `Description: ${policy.description}`, `Location: ${policy.path ?? "(generated/default)"}`].join("\n");
  }).join("\n\n");
}

export function renderPolicies(policies: Map<string, PolicyPack>, loaded: Set<string>, names: string[]): string {
  if (names.length === 0) return "No policies requested.";
  return names.map((name) => {
    const policy = policies.get(normalizeName(name));
    if (!policy) return `Policy not found: ${name}`;
    loaded.add(policy.name);
    return [`Policy: ${policy.name}`, `Description: ${policy.description}`, `Location: ${policy.path ?? "(generated/default)"}`, "", policy.content].join("\n");
  }).join("\n\n---\n\n");
}

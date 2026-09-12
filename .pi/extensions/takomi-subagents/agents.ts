import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";

export type TakomiAgentScope = "user" | "project" | "both";

export const TAKOMI_PUBLIC_AGENT_NAMES = ["architect", "designer", "coder", "worker", "reviewer", "orchestrator"] as const;
const TAKOMI_PUBLIC_AGENT_SET = new Set<string>(TAKOMI_PUBLIC_AGENT_NAMES);

export type TakomiAgentConfig = {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  defaultContext?: "fresh" | "fork";
  systemPrompt: string;
  filePath: string;
  source: "user" | "project";
};

function splitList(value?: string): string[] | undefined {
  const parts = value
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts?.length ? parts : undefined;
}

function normalizeThinking(value?: string): TakomiThinkingLevel | undefined {
  if (
    value === "off"
    || value === "minimal"
    || value === "low"
    || value === "medium"
    || value === "high"
    || value === "xhigh"
  ) {
    return value;
  }
  return undefined;
}

function loadAgentsFromDirectory(agentsDir: string, source: "user" | "project"): TakomiAgentConfig[] {
  if (!fs.existsSync(agentsDir)) return [];

  const agents: TakomiAgentConfig[] = [];
  const visit = (directory: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    } catch {
      return;
    }

    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filePath);
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) continue;
      if (!entry.name.endsWith(".md") || entry.name.endsWith(".chain.md")) continue;

      let content: string;
      try {
        content = fs.readFileSync(filePath, "utf8");
      } catch {
        continue;
      }
      const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
      if (!frontmatter.name || !frontmatter.description) continue;
      if (!TAKOMI_PUBLIC_AGENT_SET.has(frontmatter.name)) continue;

      agents.push({
        name: frontmatter.name,
        description: frontmatter.description,
        tools: splitList(frontmatter.tools),
        model: frontmatter.model,
        fallbackModels: splitList(frontmatter.fallbackModels ?? frontmatter.fallback_models),
        thinking: normalizeThinking(frontmatter.thinking),
        defaultContext: frontmatter.defaultContext === "fork" || frontmatter.defaultContext === "fresh"
          ? frontmatter.defaultContext
          : undefined,
        systemPrompt: body,
        filePath,
        source,
      });
    }
  };

  visit(agentsDir);
  return agents;
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function findNearestProjectRoot(cwd: string): string | undefined {
  let current = cwd;
  while (true) {
    if (isDirectory(path.join(current, ".pi")) || isDirectory(path.join(current, ".agents"))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

function findNearestProjectAgentsDirs(cwd: string): string[] {
  const projectRoot = findNearestProjectRoot(cwd);
  if (!projectRoot) return [];
  return [
    path.join(projectRoot, ".pi", "agents"),
    path.join(projectRoot, ".agents"),
  ].filter(isDirectory);
}

function projectAgentOverrideNames(cwd: string): Set<string> {
  const projectRoot = findNearestProjectRoot(cwd);
  if (!projectRoot) return new Set();
  const settingsPath = path.join(projectRoot, ".pi", "settings.json");
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as {
      subagents?: { agentOverrides?: Record<string, unknown> };
    };
    const overrides = settings.subagents?.agentOverrides;
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) return new Set();
    return new Set(Object.keys(overrides).filter((name) => TAKOMI_PUBLIC_AGENT_SET.has(name)));
  } catch {
    return new Set();
  }
}

export function discoverTakomiAgents(cwd: string, scope: TakomiAgentScope = "both"): TakomiAgentConfig[] {
  const projectAgentsDirs = findNearestProjectAgentsDirs(cwd);
  const localAgents = scope === "user"
    ? []
    : projectAgentsDirs.flatMap((agentsDir) => loadAgentsFromDirectory(agentsDir, "project"));
  const globalAgents = scope === "project" ? [] : loadAgentsFromDirectory(path.join(getAgentDir(), "agents"), "user");
  const merged = new Map<string, TakomiAgentConfig>();

  for (const agent of globalAgents) {
    merged.set(agent.name, agent);
  }
  for (const agent of localAgents) {
    merged.set(agent.name, agent);
  }

  if (scope !== "user") {
    for (const name of projectAgentOverrideNames(cwd)) {
      const agent = merged.get(name);
      if (agent) merged.set(name, { ...agent, source: "project" });
    }
  }

  return [...merged.values()];
}

export function discoverProjectAgents(cwd: string): TakomiAgentConfig[] {
  return discoverTakomiAgents(cwd, "both");
}

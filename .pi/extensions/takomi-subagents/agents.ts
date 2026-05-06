import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";
import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";

export type TakomiAgentScope = "user" | "project" | "both";

export type TakomiAgentConfig = {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
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

  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  const agents: TakomiAgentConfig[] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    const filePath = path.join(agentsDir, entry.name);
    const content = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
    if (!frontmatter.name || !frontmatter.description) continue;

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: splitList(frontmatter.tools),
      model: frontmatter.model,
      fallbackModels: splitList(frontmatter.fallbackModels ?? frontmatter.fallback_models),
      thinking: normalizeThinking(frontmatter.thinking),
      systemPrompt: body,
      filePath,
      source,
    });
  }

  return agents;
}

function isDirectory(target: string): boolean {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function findNearestProjectAgentsDir(cwd: string): string | undefined {
  let current = cwd;
  while (true) {
    const candidate = path.join(current, ".pi", "agents");
    if (isDirectory(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function discoverTakomiAgents(cwd: string, scope: TakomiAgentScope = "both"): TakomiAgentConfig[] {
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);
  const localAgents = scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDirectory(projectAgentsDir, "project");
  const globalAgents = scope === "project" ? [] : loadAgentsFromDirectory(path.join(os.homedir(), ".pi", "agent", "agents"), "user");
  const merged = new Map<string, TakomiAgentConfig>();

  for (const agent of globalAgents) {
    merged.set(agent.name, agent);
  }
  for (const agent of localAgents) {
    merged.set(agent.name, agent);
  }

  return [...merged.values()];
}

export function discoverProjectAgents(cwd: string): TakomiAgentConfig[] {
  return discoverTakomiAgents(cwd, "both");
}

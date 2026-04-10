import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

export type TakomiAgentConfig = {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  filePath: string;
};

function loadAgentsFromDirectory(agentsDir: string): TakomiAgentConfig[] {
  if (!fs.existsSync(agentsDir)) return [];

  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  const agents: TakomiAgentConfig[] = [];

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    const filePath = path.join(agentsDir, entry.name);
    const content = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
    if (!frontmatter.name || !frontmatter.description) continue;

    const tools = frontmatter.tools
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools,
      model: frontmatter.model,
      systemPrompt: body,
      filePath,
    });
  }

  return agents;
}

export function discoverProjectAgents(cwd: string): TakomiAgentConfig[] {
  const localAgents = loadAgentsFromDirectory(path.join(cwd, ".pi", "agents"));
  const globalAgents = loadAgentsFromDirectory(path.join(os.homedir(), ".pi", "agent", "agents"));
  const merged = new Map<string, TakomiAgentConfig>();

  for (const agent of globalAgents) {
    merged.set(agent.name, agent);
  }
  for (const agent of localAgents) {
    merged.set(agent.name, agent);
  }

  return [...merged.values()];
}

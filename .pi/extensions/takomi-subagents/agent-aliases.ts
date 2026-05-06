import type { TakomiAgentConfig } from "./agents";

const AGENT_ALIASES: Record<string, string[]> = {
  general: ["orchestrator", "coder", "architect"],
  code: ["coder"],
  build: ["coder", "orchestrator"],
  design: ["designer"],
  review: ["reviewer"],
  architecture: ["architect"],
};

export function resolveAgentName(name: string, agents: Map<string, TakomiAgentConfig>): string {
  if (agents.has(name)) return name;
  const lower = name.toLowerCase();
  const exactCase = [...agents.keys()].find((agentName) => agentName.toLowerCase() === lower);
  if (exactCase) return exactCase;
  return AGENT_ALIASES[lower]?.find((candidate) => agents.has(candidate)) ?? name;
}

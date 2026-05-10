import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ContextManagerConfig } from "./types";

export const DEFAULT_CONFIG: ContextManagerConfig = {
  candidateRouter: {
    maxCandidates: 5,
    highConfidence: 100,
    mediumConfidence: 40,
  },
  policyPaths: [".pi/takomi", ".pi/takomi/policies"],
  toolPrerequisites: {
    takomi_subagent: [{ type: "policies", policies: ["model-routing"] }],
  },
  promptCompaction: {
    compactModelRouting: true,
    compactModelRegistry: true,
    compactSkillDescriptions: true,
  },
};

function mergeConfig(value: Partial<ContextManagerConfig>): ContextManagerConfig {
  return {
    ...DEFAULT_CONFIG,
    ...value,
    candidateRouter: { ...DEFAULT_CONFIG.candidateRouter, ...value.candidateRouter },
    promptCompaction: { ...DEFAULT_CONFIG.promptCompaction, ...value.promptCompaction },
    policyPaths: value.policyPaths ?? DEFAULT_CONFIG.policyPaths,
    policyFiles: value.policyFiles,
    toolPrerequisites: value.toolPrerequisites ?? DEFAULT_CONFIG.toolPrerequisites,
  };
}

export async function loadConfig(cwd: string): Promise<ContextManagerConfig> {
  const configPath = path.resolve(cwd, ".pi/takomi/context-manager/config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return mergeConfig(JSON.parse(raw) as Partial<ContextManagerConfig>);
  } catch {
    return DEFAULT_CONFIG;
  }
}

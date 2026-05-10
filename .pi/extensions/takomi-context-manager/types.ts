export type SkillRecord = {
  name: string;
  description?: string;
  location?: string;
  source: "systemPromptOptions" | "xml" | "tool";
};

export type CandidateContext = {
  name: string;
  score: number;
  confidence: "high" | "medium";
  suggestedAction: "skill_load" | "skill_manifest";
  reasons: string[];
};

export type PolicyPack = {
  name: string;
  description: string;
  content: string;
  path?: string;
};

export type Prerequisite = { type: "policies"; policies: string[] };

export type ContextManagerConfig = {
  candidateRouter: {
    maxCandidates: number;
    highConfidence: number;
    mediumConfidence: number;
  };
  policyPaths: string[];
  policyFiles?: Record<string, string>;
  toolPrerequisites: Record<string, Prerequisite[]>;
  promptCompaction: {
    compactModelRouting: boolean;
    compactModelRegistry: boolean;
    compactSkillDescriptions: boolean;
  };
};

export type ContextReport = {
  timestamp: string;
  cwd: string;
  userPrompt: string;
  skillCount: number;
  candidates: CandidateContext[];
  loadedByTool: string[];
  loadedPolicies: string[];
  readFiles: string[];
  editedFiles: string[];
  writtenFiles: string[];
  blockedActions: Array<{ toolName: string; reason: string; timestamp: string }>;
  promptRewrite: {
    attempted: boolean;
    changed: boolean;
    originalLength: number;
    rewrittenLength: number;
    removedSections: string[];
    warnings: string[];
  };
  toolCalls: {
    skillIndex: number;
    skillManifest: number;
    skillLoad: number;
    policyManifest: number;
    policyLoad: number;
    contextReport: number;
  };
};

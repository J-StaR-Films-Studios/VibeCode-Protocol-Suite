import type { ContextReport, PolicyPack, SkillRecord } from "./types";

export type ContextManagerState = {
  skills: Map<string, SkillRecord>;
  policies: Map<string, PolicyPack>;
  loadedPolicies: Set<string>;
  readFiles: Set<string>;
  editedFiles: Set<string>;
  writtenFiles: Set<string>;
  report: ContextReport;
};

export function createEmptyReport(): ContextReport {
  return {
    timestamp: new Date().toISOString(),
    cwd: "",
    userPrompt: "",
    skillCount: 0,
    candidates: [],
    loadedByTool: [],
    loadedPolicies: [],
    readFiles: [],
    editedFiles: [],
    writtenFiles: [],
    blockedActions: [],
    modelRoutingCorrections: [],
    duplicateExtensionWarnings: [],
    sessionRestore: {
      attempted: false,
      restored: false,
      snapshotCount: 0,
      toolResultCount: 0,
      note: "No session restore attempted yet.",
    },
    promptRewrite: {
      attempted: false,
      changed: false,
      originalLength: 0,
      rewrittenLength: 0,
      removedSections: [],
      warnings: [],
    },
    toolCalls: {
      skillIndex: 0,
      skillManifest: 0,
      skillLoad: 0,
      policyManifest: 0,
      policyLoad: 0,
      contextReport: 0,
    },
  };
}

export function createState(): ContextManagerState {
  return {
    skills: new Map(),
    policies: new Map(),
    loadedPolicies: new Set(),
    readFiles: new Set(),
    editedFiles: new Set(),
    writtenFiles: new Set(),
    report: createEmptyReport(),
  };
}

export function syncReportLedger(state: ContextManagerState): void {
  state.report.loadedPolicies = [...state.loadedPolicies].sort();
  state.report.readFiles = [...state.readFiles].sort();
  state.report.editedFiles = [...state.editedFiles].sort();
  state.report.writtenFiles = [...state.writtenFiles].sort();
}

export function recordBlocked(state: ContextManagerState, toolName: string, reason: string): void {
  const timestamp = new Date().toISOString();
  state.report.timestamp = timestamp;
  state.report.blockedActions.push({ toolName, reason, timestamp });
  syncReportLedger(state);
}

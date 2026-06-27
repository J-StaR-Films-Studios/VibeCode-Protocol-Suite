import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ContextManagerState } from "./state";
import type { ContextReport } from "./types";

const SNAPSHOT_TYPE = "takomi-context-manager-report";
const TOOL_NAMES = ["skill_index", "skill_manifest", "skill_load", "policy_manifest", "policy_load", "context_report"] as const;
type ToolName = typeof TOOL_NAMES[number];

type RestoreStats = {
  snapshotCount: number;
  toolResultCount: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function mergeReports(base: ContextReport, restored: ContextReport | undefined): ContextReport {
  if (!restored) return base;
  return {
    ...base,
    ...restored,
    toolCalls: { ...base.toolCalls, ...restored.toolCalls },
    promptRewrite: { ...base.promptRewrite, ...restored.promptRewrite },
    sessionRestore: { ...base.sessionRestore, ...restored.sessionRestore },
  };
}

function maxToolCalls(a: ContextReport["toolCalls"], b: ContextReport["toolCalls"]): ContextReport["toolCalls"] {
  return {
    skillIndex: Math.max(a.skillIndex, b.skillIndex),
    skillManifest: Math.max(a.skillManifest, b.skillManifest),
    skillLoad: Math.max(a.skillLoad, b.skillLoad),
    policyManifest: Math.max(a.policyManifest, b.policyManifest),
    policyLoad: Math.max(a.policyLoad, b.policyLoad),
    contextReport: Math.max(a.contextReport, b.contextReport),
  };
}

function incrementTool(calls: ContextReport["toolCalls"], toolName: ToolName): void {
  if (toolName === "skill_index") calls.skillIndex += 1;
  if (toolName === "skill_manifest") calls.skillManifest += 1;
  if (toolName === "skill_load") calls.skillLoad += 1;
  if (toolName === "policy_manifest") calls.policyManifest += 1;
  if (toolName === "policy_load") calls.policyLoad += 1;
  if (toolName === "context_report") calls.contextReport += 1;
}

function getEntryData(entry: unknown): unknown {
  const record = asRecord(entry);
  if (record.type === "custom" && record.customType === SNAPSHOT_TYPE) return record.data;
  const message = asRecord(record.message);
  if (message.role === "custom" && message.customType === SNAPSHOT_TYPE) return message.details ?? message.content;
  return undefined;
}

function getToolResult(entry: unknown): { toolName?: string; details?: Record<string, unknown> } | undefined {
  const record = asRecord(entry);
  if (record.type !== "message") return undefined;
  const message = asRecord(record.message);
  if (message.role !== "toolResult") return undefined;
  return { toolName: typeof message.toolName === "string" ? message.toolName : undefined, details: asRecord(message.details) };
}

function getEntries(ctx: unknown): unknown[] {
  const manager = asRecord(ctx).sessionManager as { getEntries?: () => unknown[]; getBranch?: () => unknown[] } | undefined;
  try {
    return manager?.getEntries?.() ?? manager?.getBranch?.() ?? [];
  } catch {
    return [];
  }
}

function extractSnapshot(data: unknown): ContextReport | undefined {
  const record = asRecord(data);
  const report = asRecord(record.report);
  if (!report || typeof report.timestamp !== "string") return undefined;
  return report as ContextReport;
}

export function restoreReportFromSession(state: ContextManagerState, ctx: unknown): RestoreStats {
  const entries = getEntries(ctx);
  let latestSnapshot: ContextReport | undefined;
  let snapshotCount = 0;
  let toolResultCount = 0;
  const countedToolCalls: ContextReport["toolCalls"] = { skillIndex: 0, skillManifest: 0, skillLoad: 0, policyManifest: 0, policyLoad: 0, contextReport: 0 };
  const loadedSkills = new Set(state.report.loadedByTool);
  const loadedPolicies = new Set(state.report.loadedPolicies);

  for (const entry of entries) {
    const snapshot = extractSnapshot(getEntryData(entry));
    if (snapshot) {
      snapshotCount += 1;
      if (!latestSnapshot || snapshot.timestamp >= latestSnapshot.timestamp) latestSnapshot = snapshot;
    }

    const toolResult = getToolResult(entry);
    if (!toolResult?.toolName || !(TOOL_NAMES as readonly string[]).includes(toolResult.toolName)) continue;
    toolResultCount += 1;
    incrementTool(countedToolCalls, toolResult.toolName as ToolName);
    if (toolResult.toolName === "skill_load" && typeof toolResult.details?.skill === "string") loadedSkills.add(toolResult.details.skill);
    if (toolResult.toolName === "policy_load" && Array.isArray(toolResult.details?.loadedPolicies)) {
      for (const policy of toolResult.details.loadedPolicies) if (typeof policy === "string") loadedPolicies.add(policy);
    }
  }

  state.report = mergeReports(state.report, latestSnapshot);
  state.report.loadedByTool ??= [];
  state.report.loadedPolicies ??= [];
  state.report.blockedActions ??= [];
  state.report.modelRoutingCorrections ??= [];
  state.report.duplicateExtensionWarnings ??= [];
  for (const skill of state.report.loadedByTool) loadedSkills.add(skill);
  for (const policy of state.report.loadedPolicies) loadedPolicies.add(policy);
  state.report.toolCalls = maxToolCalls(state.report.toolCalls, countedToolCalls);
  state.report.loadedByTool = uniqueSorted(loadedSkills);
  state.report.loadedPolicies = uniqueSorted(loadedPolicies);
  state.loadedPolicies = new Set(state.report.loadedPolicies);
  state.report.sessionRestore = {
    attempted: true,
    restored: Boolean(latestSnapshot) || toolResultCount > 0,
    snapshotCount,
    toolResultCount,
    note: latestSnapshot
      ? "Restored from Takomi context-manager snapshots and Pi tool-result history in the current session file."
      : toolResultCount > 0
        ? "Restored from Pi tool-result history in the current session file; no context-manager snapshot was found."
        : "No prior context-manager snapshots or tool results were found in the current session file.",
  };
  return { snapshotCount, toolResultCount };
}

function compactReason(reason: string): string {
  const firstMeaningfulLine = reason.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? reason;
  if (/Loaded policy context:/i.test(reason)) return `${firstMeaningfulLine}\n[policy content omitted from persisted context-manager snapshot]`;
  return reason.length > 1200 ? `${reason.slice(0, 1200)}…\n[truncated in persisted context-manager snapshot]` : reason;
}

function snapshotReport(report: ContextReport): ContextReport {
  return {
    ...report,
    blockedActions: report.blockedActions.map((action) => ({ ...action, reason: compactReason(action.reason) })),
  };
}

export function persistReportSnapshot(pi: ExtensionAPI, state: ContextManagerState, reason: string): void {
  try {
    pi.appendEntry(SNAPSHOT_TYPE, {
      version: 1,
      reason,
      report: snapshotReport(state.report),
    });
  } catch {
    // Persistence should never break agent startup or tool execution.
  }
}

import type { ContextManagerState } from "./state";
import { sortedSkills } from "./skill-registry";
import { syncReportLedger } from "./state";
import { renderDuplicateExtensionGuidance } from "./extension-conflicts";

export function renderReport(state: ContextManagerState, verbose = false): string {
  syncReportLedger(state);
  const report = state.report;
  const reduction = report.promptRewrite.originalLength > 0
    ? Math.round((1 - report.promptRewrite.rewrittenLength / report.promptRewrite.originalLength) * 1000) / 10
    : 0;
  const lines = [
    "Takomi Context Manager Report",
    `- Timestamp: ${report.timestamp}`,
    `- CWD: ${report.cwd || "(unknown)"}`,
    "- Scope: latest context-manager prompt rewrite and context-manager tool state only; this is not a full Pi session transcript.",
    `- Skill count discovered: ${report.skillCount}`,
    `- Prompt rewrite attempted: ${report.promptRewrite.attempted ? "yes" : "no"}`,
    `- Prompt changed: ${report.promptRewrite.changed ? "yes" : "no"}`,
    `- Original prompt length observed by context manager: ${report.promptRewrite.originalLength} chars`,
    `- Rewritten prompt length returned by context manager: ${report.promptRewrite.rewrittenLength} chars`,
    `- Context-manager prompt reduction: ${reduction}%`,
    `- Sections compressed/removed by context manager: ${report.promptRewrite.removedSections.join(", ") || "none"}`,
    `- Skills loaded through skill_load: ${report.loadedByTool.join(", ") || "none"}`,
    `- Policies loaded through policy_load/gates: ${report.loadedPolicies.join(", ") || "none"}`,
    `- Context-manager tracked read files: ${report.readFiles.length}`,
    `- Context-manager tracked edited files: ${report.editedFiles.length}`,
    `- Context-manager tracked written files: ${report.writtenFiles.length}`,
    `- Blocked context-manager gated actions: ${report.blockedActions.length}`,
    `- Duplicate Takomi extension tool-name warnings: ${report.duplicateExtensionWarnings.length}`,
    `- Context-manager tool calls: skill_index=${report.toolCalls.skillIndex}, skill_manifest=${report.toolCalls.skillManifest}, skill_load=${report.toolCalls.skillLoad}, policy_manifest=${report.toolCalls.policyManifest}, policy_load=${report.toolCalls.policyLoad}, context_report=${report.toolCalls.contextReport}`,
    `- Rewrite warnings: ${report.promptRewrite.warnings.join("; ") || "none"}`,
    "- Note: native Pi read/edit/write/bash calls are not counted here unless a context-manager tool explicitly records them.",
  ];
  if (report.candidates.length > 0) {
    lines.push("- Candidates:");
    for (const candidate of report.candidates) {
      lines.push(`  - ${candidate.name} (${candidate.confidence}, ${candidate.score}): ${candidate.reasons.join("; ")}`);
    }
  } else {
    lines.push("- Candidates: none");
  }
  if (report.duplicateExtensionWarnings.length > 0 || verbose) {
    lines.push("", "Extension Conflict Diagnostics:", ...renderDuplicateExtensionGuidance(report.duplicateExtensionWarnings, report.cwd));
  }
  if (verbose) {
    lines.push("", "Skill Index:", ...sortedSkills(state.skills).map((skill) => `- ${skill.name}`));
    lines.push("", "Policy Packs:", ...[...state.policies.values()].map((policy) => `- ${policy.name}: ${policy.description}`));
    if (report.blockedActions.length > 0) {
      lines.push("", "Blocked Actions:");
      for (const action of report.blockedActions.slice(-10)) lines.push(`- ${action.timestamp} ${action.toolName}: ${action.reason}`);
    }
  }
  return lines.join("\n");
}

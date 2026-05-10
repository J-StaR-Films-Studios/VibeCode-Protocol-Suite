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
    `- Skill count: ${report.skillCount}`,
    `- Prompt rewrite attempted: ${report.promptRewrite.attempted ? "yes" : "no"}`,
    `- Prompt changed: ${report.promptRewrite.changed ? "yes" : "no"}`,
    `- Original prompt length: ${report.promptRewrite.originalLength} chars`,
    `- Rewritten prompt length: ${report.promptRewrite.rewrittenLength} chars`,
    `- Reduction: ${reduction}%`,
    `- Removed sections: ${report.promptRewrite.removedSections.join(", ") || "none"}`,
    `- Loaded skills: ${report.loadedByTool.join(", ") || "none"}`,
    `- Loaded policies: ${report.loadedPolicies.join(", ") || "none"}`,
    `- Read files: ${report.readFiles.length}`,
    `- Edited files: ${report.editedFiles.length}`,
    `- Written files: ${report.writtenFiles.length}`,
    `- Blocked actions: ${report.blockedActions.length}`,
    `- Duplicate extension warnings: ${report.duplicateExtensionWarnings.length}`,
    `- Tool calls: skill_index=${report.toolCalls.skillIndex}, skill_manifest=${report.toolCalls.skillManifest}, skill_load=${report.toolCalls.skillLoad}, policy_manifest=${report.toolCalls.policyManifest}, policy_load=${report.toolCalls.policyLoad}, context_report=${report.toolCalls.contextReport}`,
    `- Warnings: ${report.promptRewrite.warnings.join("; ") || "none"}`,
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
    lines.push("", "Extension Conflict Diagnostics:", ...renderDuplicateExtensionGuidance(report.duplicateExtensionWarnings));
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

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ContextManagerConfig } from "./types";
import type { ContextManagerState } from "./state";
import { recordBlocked, syncReportLedger } from "./state";
import { renderPolicies } from "./policy-registry";

function renderPolicyGateBlock(toolName: string, missing: string[], policyText: string): string {
  return [
    `Blocked ${toolName}: required policy context had not been loaded yet.`,
    "",
    "The required policy context is provided below and has now been marked as loaded for this session.",
    "Retry the original tool call now, following the policy.",
    "",
    "Required policies:",
    ...missing.map((policy) => `- ${policy}`),
    "",
    "Loaded policy context:",
    policyText,
  ].join("\n");
}

export function installPrerequisiteGates(pi: ExtensionAPI, state: ContextManagerState, getConfig: () => ContextManagerConfig): void {
  pi.on("tool_call", async (event, ctx) => {
    state.report.cwd = ctx.cwd;
    const prereqs = getConfig().toolPrerequisites[event.toolName] ?? [];

    for (const prereq of prereqs) {
      if (prereq.type !== "policies") continue;
      const missing = prereq.policies.filter((policy) => !state.loadedPolicies.has(policy));
      if (missing.length === 0) continue;

      const policyText = renderPolicies(state.policies, state.loadedPolicies, missing);
      syncReportLedger(state);
      const reason = renderPolicyGateBlock(event.toolName, missing, policyText);
      recordBlocked(state, event.toolName, reason);
      return { block: true, reason };
    }
  });
}

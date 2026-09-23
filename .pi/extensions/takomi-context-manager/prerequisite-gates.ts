import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ContextManagerConfig } from "./types";
import type { ContextManagerState } from "./state";
import { recordBlocked, syncReportLedger } from "./state";
import { renderPolicies } from "./policy-registry";
import { persistReportSnapshot } from "./session-state";

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

      if (missing.includes("model-routing") && !state.policies.has("model-routing")) {
        if (!state.report.continueWithoutRoutingPolicy) {
          const choice = ctx.hasUI ? await ctx.ui.select("No Takomi routing policy is available. How should delegation proceed?", [
            "Continue with harness defaults for this session",
            "Set up a routing policy",
          ]) : undefined;
          if (choice === "Continue with harness defaults for this session") {
            state.report.continueWithoutRoutingPolicy = true;
            persistReportSnapshot(pi, state, "routing-policy-session-approval");
          } else {
            const reason = choice === "Set up a routing policy"
              ? "Delegation paused. Ask the user for routing guidance and whether to save it for this project or globally. Use /takomi routing to review and save the policy, then retry."
              : "Delegation paused: no routing policy is available and session-only continuation was not approved. Ask the user whether to continue with harness defaults or set up a routing policy.";
            recordBlocked(state, event.toolName, reason);
            persistReportSnapshot(pi, state, "prerequisite-gate-block");
            return { block: true, reason, terminate: true };
          }
        }
        missing.splice(missing.indexOf("model-routing"), 1);
        if (missing.length === 0) continue;
      }

      const policyText = renderPolicies(state.policies, state.loadedPolicies, missing);
      syncReportLedger(state);
      const reason = renderPolicyGateBlock(event.toolName, missing, policyText);
      recordBlocked(state, event.toolName, reason);
      persistReportSnapshot(pi, state, "prerequisite-gate-block");
      return { block: true, reason };
    }
  });
}

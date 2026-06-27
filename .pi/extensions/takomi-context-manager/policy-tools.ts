import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { syncReportLedger } from "./state";
import { renderPolicies, renderPolicyManifest } from "./policy-registry";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";

export function registerPolicyTools(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "policy_manifest",
    label: "Policy Manifest",
    description: "Return descriptions for available context policy packs without loading full policy content.",
    promptSnippet: "Show available context policy pack descriptions",
    parameters: Type.Object({ policies: Type.Optional(Type.Array(Type.String({ description: "Policy name to inspect" }))) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.policyManifest += 1;
      persistReportSnapshot(pi, state, "policy_manifest");
      return { content: [{ type: "text", text: renderPolicyManifest(state.policies, params.policies ?? []) }], details: { requested: params.policies ?? [...state.policies.keys()] } };
    },
  });

  pi.registerTool({
    name: "policy_load",
    label: "Policy Load",
    description: "Load one or more context policy packs required before sensitive tools such as takomi_subagent.",
    promptSnippet: "Load policy packs required before sensitive tool calls",
    parameters: Type.Object({ policies: Type.Array(Type.String({ description: "Policy pack name to load" })) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.policyLoad += 1;
      const text = renderPolicies(state.policies, state.loadedPolicies, params.policies);
      syncReportLedger(state);
      persistReportSnapshot(pi, state, "policy_load");
      return { content: [{ type: "text", text }], details: { requested: params.policies, loadedPolicies: [...state.loadedPolicies].sort() } };
    },
  });
}

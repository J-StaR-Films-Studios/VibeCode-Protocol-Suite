import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, DEFAULT_CONFIG } from "./config";
import { createState, syncReportLedger } from "./state";
import { collectSkillsFromOptions, collectSkillsFromXml, discoverSkillsFromFilesystem, enrichSkillsWithInstallerTaxonomy, mergeSkills } from "./skill-registry";
import { discoverPolicies } from "./policy-registry";
import { findCandidates } from "./context-router";
import { rewritePrompt } from "./prompt-rewriter";
import { registerSkillTools } from "./skill-tools";
import { registerPolicyTools } from "./policy-tools";
import { registerDiagnostics } from "./diagnostics-tools";
import { installPrerequisiteGates } from "./prerequisite-gates";
import { installModelPolicyGate } from "./model-policy-gate";
import { detectDuplicateTakomiExtensions } from "./extension-conflicts";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";
import { loadTakomiModelRoutingSnapshot, renderCompactTakomiModelRoutingSummary } from "../takomi-runtime/model-routing-defaults";
import type { ContextManagerConfig } from "./types";

export default function takomiContextManager(pi: ExtensionAPI) {
  const state = createState();
  let config: ContextManagerConfig = DEFAULT_CONFIG;
  let duplicateExtensionWarnings: Array<{ toolName: string; paths: string[] }> = [];

  registerSkillTools(pi, state);
  registerPolicyTools(pi, state);
  registerDiagnostics(pi, state);
  installPrerequisiteGates(pi, state, () => config);
  installModelPolicyGate(pi, state);

  pi.on("session_start", async (_event, ctx) => {
    config = await loadConfig(ctx.cwd);
    [state.policies, duplicateExtensionWarnings] = await Promise.all([
      discoverPolicies(ctx.cwd, config),
      detectDuplicateTakomiExtensions(ctx.cwd),
    ]);

    // Pi already discovers skills while building systemPromptOptions. Rewalking
    // every global/project skill tree here made startup block on thousands of
    // filesystem calls, then repeated the same work before the first request.
    // Keep filesystem discovery lazy for direct skill-tool calls and as a
    // compatibility fallback when Pi supplies no skill metadata.
    state.skills = new Map();
    state.report.cwd = ctx.cwd;
    state.report.skillCount = 0;
    restoreReportFromSession(state, ctx);
    if (!state.policies.has("model-routing")) {
      state.loadedPolicies.delete("model-routing");
      syncReportLedger(state);
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    // Re-resolve between turns so a policy saved after a pause (or one that
    // replaces the bundled fallback) is visible before the next delegation.
    state.policies = await discoverPolicies(ctx.cwd, config);
    if (!state.policies.has("model-routing")) {
      state.loadedPolicies.delete("model-routing");
      syncReportLedger(state);
    }
    const optionSkills = collectSkillsFromOptions(event.systemPromptOptions);
    const xmlSkills = collectSkillsFromXml(event.systemPrompt);
    const suppliedSkills = [...optionSkills, ...xmlSkills];
    const enrichedSuppliedSkills = await enrichSkillsWithInstallerTaxonomy(suppliedSkills);
    const filesystemSkills = suppliedSkills.length === 0
      ? await discoverSkillsFromFilesystem(ctx.cwd)
      : [];
    state.skills = mergeSkills([...filesystemSkills, ...enrichedSuppliedSkills]);

    const candidates = findCandidates(event.prompt, state.skills, config);
    const rewrite = rewritePrompt(event.systemPrompt, state.skills, candidates, config);
    const routingSummary = renderCompactTakomiModelRoutingSummary(await loadTakomiModelRoutingSnapshot(ctx.cwd));
    // The model must see routing guidance before choosing a subagent model.
    // A tool_call hook runs too late to supply it without blocking and retrying.
    const routingPolicy = state.policies.get("model-routing");
    const policyContext = routingPolicy
      ? `Takomi model-routing policy:\n\n${routingPolicy.content}`
      : "";
    if (policyContext) {
      state.loadedPolicies.add("model-routing");
      syncReportLedger(state);
    }
    const rewrittenPrompt = [rewrite.prompt, routingSummary, policyContext].filter(Boolean).join("\n\n");
    state.report = {
      ...state.report,
      timestamp: new Date().toISOString(),
      cwd: ctx.cwd,
      userPrompt: event.prompt,
      skillCount: state.skills.size,
      candidates,
      duplicateExtensionWarnings,
      promptRewrite: {
        attempted: true,
        changed: rewrite.changed || Boolean(routingSummary) || Boolean(policyContext),
        originalLength: event.systemPrompt.length,
        rewrittenLength: rewrittenPrompt.length,
        removedSections: rewrite.removedSections,
        warnings: rewrite.warnings,
      },
    };
    persistReportSnapshot(pi, state, "before_agent_start");

    return { systemPrompt: rewrittenPrompt };
  });
}

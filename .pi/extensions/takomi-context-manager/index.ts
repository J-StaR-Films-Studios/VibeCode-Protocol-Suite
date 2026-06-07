import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadConfig, DEFAULT_CONFIG } from "./config";
import { createState } from "./state";
import { collectSkillsFromOptions, collectSkillsFromXml, mergeSkills } from "./skill-registry";
import { discoverPolicies } from "./policy-registry";
import { findCandidates } from "./context-router";
import { rewritePrompt } from "./prompt-rewriter";
import { registerSkillTools } from "./skill-tools";
import { registerPolicyTools } from "./policy-tools";
import { registerDiagnostics } from "./diagnostics-tools";
import { installPrerequisiteGates } from "./prerequisite-gates";
import { installModelPolicyGate } from "./model-policy-gate";
import { detectDuplicateTakomiExtensions } from "./extension-conflicts";
import { loadTakomiModelRoutingSnapshot, renderCompactTakomiModelRoutingSummary } from "../takomi-runtime/model-routing-defaults";
import type { ContextManagerConfig } from "./types";

export default function takomiContextManager(pi: ExtensionAPI) {
  const state = createState();
  let config: ContextManagerConfig = DEFAULT_CONFIG;

  registerSkillTools(pi, state);
  registerPolicyTools(pi, state);
  registerDiagnostics(pi, state);
  installPrerequisiteGates(pi, state, () => config);
  installModelPolicyGate(pi, state);

  pi.on("before_agent_start", async (event, ctx) => {
    config = await loadConfig(ctx.cwd);
    state.policies = await discoverPolicies(ctx.cwd, config);
    const duplicateExtensionWarnings = await detectDuplicateTakomiExtensions(ctx.cwd);
    const optionSkills = collectSkillsFromOptions(event.systemPromptOptions);
    const xmlSkills = collectSkillsFromXml(event.systemPrompt);
    state.skills = mergeSkills([...optionSkills, ...xmlSkills]);

    const candidates = findCandidates(event.prompt, state.skills, config);
    const rewrite = rewritePrompt(event.systemPrompt, state.skills, candidates, config);
    const routingSummary = renderCompactTakomiModelRoutingSummary(await loadTakomiModelRoutingSnapshot(ctx.cwd));
    const rewrittenPrompt = routingSummary ? `${rewrite.prompt}\n\n${routingSummary}` : rewrite.prompt;
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
        changed: rewrite.changed || Boolean(routingSummary),
        originalLength: event.systemPrompt.length,
        rewrittenLength: rewrittenPrompt.length,
        removedSections: rewrite.removedSections,
        warnings: rewrite.warnings,
      },
    };

    return { systemPrompt: rewrittenPrompt };
  });
}

import type { CandidateContext, ContextManagerConfig, SkillRecord } from "./types";
import { renderCandidateHint } from "./context-router";
import { sortedSkills } from "./skill-registry";

function renderSkillIndex(skills: SkillRecord[]): string {
  if (skills.length === 0) return "Skills: none discovered.";
  return `Skills: ${skills.length} discovered. Use skill_index only when the task may need a skill.`;
}

function renderProgressiveRule(): string {
  return [
    "Skill loading:",
    "- Skills are optional capability packs that give you special instructions/tools for specialized, repetitive tasks.",
    "- Do not preload skill descriptions into the prompt.",
    "- When doing specialized work, you may check whether a suited skill exists with skill_index.",
    "- For uncertain matches, request skill_manifest for likely skills; manifests include descriptions and locations.",
    "- If a skill is clearly relevant or the user names it directly, use skill_load without requesting a manifest first.",
    "- Load full skill instructions only for skills you will actually use.",
    "",
    "Policy loading:",
    "- Model/subagent/lifecycle policies are lazy-loaded policy packs.",
    "- Use policy_manifest to inspect available policies.",
    "- Use policy_load before sensitive tools such as takomi_subagent.",
  ].join("\n");
}

function compactHeavyPolicyBlocks(prompt: string, config: ContextManagerConfig): { prompt: string; removedSections: string[] } {
  let next = prompt;
  const removedSections: string[] = [];
  if (config.promptCompaction.compactModelRouting) {
    const modelRoutingRegex = /Project Takomi model routing policy is active\. Apply it when choosing parent\/subagent models and escalation levels:\s*\n\n# Takomi Model Routing Policy[\s\S]*?(?=\nAvailable model context from Pi registry:)/;
    if (modelRoutingRegex.test(next)) {
      next = next.replace(modelRoutingRegex, [
        "Project Takomi model routing policy is available as a lazy-loaded policy pack.",
        "The subagent prerequisite gate can provide this policy automatically on first blocked takomi_subagent attempt, then the agent should retry.",
        "",
      ].join("\n"));
      removedSections.push("full model routing policy");
    }
  }
  if (config.promptCompaction.compactModelRegistry) {
    const registryRegex = /Available model context from Pi registry:[^\n]*(?:\n|$)/;
    if (registryRegex.test(next)) {
      next = next.replace(registryRegex, "Available model registry context exists. The subagent policy gate will provide model routing context if needed.\n");
      removedSections.push("verbose model registry list");
    }
  }
  return { prompt: next, removedSections };
}

export function rewritePrompt(systemPrompt: string, skills: Map<string, SkillRecord>, candidates: CandidateContext[], config: ContextManagerConfig): {
  prompt: string;
  changed: boolean;
  removedSections: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const removedSections: string[] = [];
  let next = systemPrompt;
  let changed = false;

  if (config.promptCompaction.compactSkillDescriptions) {
    const replacement = [renderSkillIndex(sortedSkills(skills)), renderProgressiveRule(), renderCandidateHint(candidates)].filter(Boolean).join("\n\n");
    const skillBlockRegex = /<available_skills>[\s\S]*?<\/available_skills>/i;
    if (!skillBlockRegex.test(next)) {
      warnings.push("No <available_skills> block found; appended progressive skill guidance instead.");
      next = `${next}\n\n${replacement}`;
      changed = true;
    } else {
      next = next.replace(skillBlockRegex, replacement);
      changed = true;
      removedSections.push("available_skills descriptions");
    }
  }

  const compacted = compactHeavyPolicyBlocks(next, config);
  next = compacted.prompt;
  removedSections.push(...compacted.removedSections);
  changed = changed || compacted.removedSections.length > 0;
  return { prompt: next, changed, removedSections, warnings };
}

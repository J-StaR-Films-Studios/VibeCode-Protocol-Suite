import type { CandidateContext, ContextManagerConfig, SkillRecord } from "./types";
import { renderCandidateHint } from "./context-router";
import { sortedSkills } from "./skill-registry";

function renderSkillNames(skills: SkillRecord[]): string {
  return ["Available skills (names only):", ...skills.map((skill) => `- ${skill.name}`)].join("\n");
}

function renderSkillDisplay(skills: SkillRecord[], candidates: CandidateContext[], config: ContextManagerConfig): string {
  const mode = config.skillDisplay.mode;
  const countLine = skills.length === 0 ? "Skills: none discovered." : `Skills: ${skills.length} available.`;

  if (mode === "hidden") return `${countLine} Use skill_index if this task may need a skill.`;
  if (mode === "all-names") return skills.length === 0 ? countLine : renderSkillNames(skills);
  if (mode === "auto" && skills.length <= config.skillDisplay.maxVisibleSkillNames) {
    return skills.length === 0 ? countLine : renderSkillNames(skills);
  }

  const candidateHint = renderCandidateHint(candidates);
  return [countLine, candidateHint || "Use skill_index if a specialized skill may help."].join("\n");
}

function renderProgressiveRule(config: ContextManagerConfig): string {
  if (!config.skillDisplay.alwaysShowToolInstructions) return "";
  return [
    "Skill loading:",
    "- Skills are optional capability packs that give you special instructions/tools for specialized, repetitive tasks.",
    "- Do not preload skill descriptions into the prompt.",
    "- Use skill_index to view all skill names when needed.",
    "- For uncertain matches, request skill_manifest for likely skills; manifests include descriptions and locations.",
    "- If a skill is clearly relevant or the user names it directly, use skill_load without requesting a manifest first.",
    "- Load full skill instructions only for skills you will actually use.",
    "",
    "Policy loading:",
    "- Model-routing guidance is supplied before delegation when available; other policies are loaded on demand.",
    "- The active routing policy may come from the project, global settings, or the bundled Takomi harness default.",
    "- Use policy_manifest or policy_load when you need to inspect or quote another policy explicitly.",
    "- If no routing policy exists, ask the user before continuing with harness defaults or setting one up.",
  ].join("\n");
}

function compactHeavyPolicyBlocks(prompt: string, config: ContextManagerConfig, routingPolicyContent?: string): { prompt: string; removedSections: string[] } {
  let next = prompt;
  const removedSections: string[] = [];
  // Remove only the exact runtime copy of the policy the caller will supply again.
  // Registry IDs and optional tool guidance are not duplicate policy content.
  if (config.promptCompaction.compactModelRouting && routingPolicyContent) {
    for (const source of ["Project", "Bundled"]) {
      const block = `${source} Takomi model routing policy is active. Apply it when choosing parent/subagent models and escalation levels:\n\n${routingPolicyContent}`;
      const start = next.indexOf(block);
      const end = start + block.length;
      if (start >= 0 && (start === 0 || next.slice(start - 2, start) === "\n\n")
        && (end === next.length || next.slice(end, end + 2) === "\n\n")) {
        next = next.slice(0, start) + "Takomi model routing policy is provided by the context manager before delegation." + next.slice(end);
        removedSections.push("duplicate runtime model routing policy");
      }
    }
  }
  return { prompt: next, removedSections };
}

export function rewritePrompt(systemPrompt: string, skills: Map<string, SkillRecord>, candidates: CandidateContext[], config: ContextManagerConfig, routingPolicyContent?: string): {
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
    const sorted = sortedSkills(skills);
    const replacement = [
      renderSkillDisplay(sorted, candidates, config),
      renderProgressiveRule(config),
    ].filter(Boolean).join("\n\n");
    const skillBlockRegex = /<available_skills>([\s\S]*?)<\/available_skills>/i;
    const block = next.match(skillBlockRegex);
    const nativeSkillRegex = /<skill>\s*<name>[^<]+<\/name>\s*<description>[^<]*<\/description>\s*<location>[^<]+<\/location>\s*<\/skill>/gi;
    const supported = block && nativeSkillRegex.test(block[1]) && !block[1].replace(nativeSkillRegex, "").trim();
    if (!supported) {
      warnings.push(`Skill description compaction unavailable: ${block ? "unsupported <available_skills> contents" : "no supported <available_skills> block found"}; preserved original instructions and appended loading guidance.`);
      next = `${next}\n\n${replacement}`;
      changed = true;
    } else {
      next = next.replace(skillBlockRegex, replacement);
      changed = true;
      removedSections.push(`available_skills descriptions (${config.skillDisplay.mode} display)`);
    }
  }

  const compacted = compactHeavyPolicyBlocks(next, config, routingPolicyContent);
  next = compacted.prompt;
  removedSections.push(...compacted.removedSections);
  changed = changed || compacted.removedSections.length > 0;
  return { prompt: next, changed, removedSections, warnings };
}

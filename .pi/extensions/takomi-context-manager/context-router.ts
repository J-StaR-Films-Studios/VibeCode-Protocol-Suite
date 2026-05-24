import type { CandidateContext, ContextManagerConfig, SkillRecord } from "./types";
import { normalizeName, normalizeText, sortedSkills } from "./skill-registry";

const STOPWORDS = new Set(["a", "an", "and", "are", "as", "for", "from", "in", "is", "it", "of", "on", "or", "the", "this", "to", "with", "when", "you"]);

function meaningfulWords(value: string): string[] {
  return normalizeText(value).split(" ").filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

function scoreSkill(prompt: string, skill: SkillRecord, config: ContextManagerConfig): CandidateContext | undefined {
  const promptNorm = normalizeText(prompt);
  if (!promptNorm) return undefined;
  const reasons: string[] = [];
  let score = 0;
  const nameNorm = normalizeText(skill.name);
  if (nameNorm && promptNorm.includes(nameNorm)) {
    score += 100;
    reasons.push("exact skill name match");
  }
  const nameWords = meaningfulWords(skill.name);
  const matchedNameWords = nameWords.filter((word) => promptNorm.includes(word));
  if (matchedNameWords.length > 0 && matchedNameWords.length === nameWords.length) {
    score += 50;
    reasons.push(`matched skill name words: ${matchedNameWords.join(", ")}`);
  } else if (matchedNameWords.length > 0) {
    score += 15 * matchedNameWords.length;
    reasons.push(`partial skill name words: ${matchedNameWords.join(", ")}`);
  }
  const descriptionWords = meaningfulWords(skill.description ?? "").slice(0, 50);
  const matchedDescriptionWords = [...new Set(descriptionWords.filter((word) => promptNorm.includes(word)))];
  if (matchedDescriptionWords.length > 0) {
    score += Math.min(50, matchedDescriptionWords.length * 10);
    reasons.push(`description keywords: ${matchedDescriptionWords.slice(0, 5).join(", ")}`);
  }
  if (score < config.candidateRouter.mediumConfidence) return undefined;
  const confidence = score >= config.candidateRouter.highConfidence ? "high" : "medium";
  return {
    name: skill.name,
    score,
    confidence,
    suggestedAction: confidence === "high" ? "skill_load" : "skill_manifest",
    reasons,
  };
}

export function findCandidates(prompt: string, skills: Map<string, SkillRecord>, config: ContextManagerConfig): CandidateContext[] {
  return sortedSkills(skills)
    .map((skill) => scoreSkill(prompt, skill, config))
    .filter((candidate): candidate is CandidateContext => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, config.candidateRouter.maxCandidates);
}

export function renderCandidateHint(candidates: CandidateContext[]): string {
  if (candidates.length === 0) return "";
  return ["Potentially relevant skills:", ...candidates.map((candidate) => `- ${candidate.name} — use ${candidate.suggestedAction} if relevant`)].join("\n");
}

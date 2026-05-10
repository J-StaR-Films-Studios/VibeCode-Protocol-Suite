import type { SkillRecord } from "./types";

export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function getString(input: unknown, keys: string[]): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function collectSkillsFromOptions(options: unknown): SkillRecord[] {
  if (!options || typeof options !== "object") return [];
  const skills = (options as { skills?: unknown }).skills;
  const rawList = Array.isArray(skills)
    ? skills
    : skills && typeof skills === "object"
      ? Object.values(skills as Record<string, unknown>)
      : [];
  return rawList.flatMap((item): SkillRecord[] => {
    const name = getString(item, ["name", "id", "title"]);
    if (!name) return [];
    return [{
      name,
      description: getString(item, ["description", "summary"]),
      location: getString(item, ["location", "path", "file", "skillPath"]),
      source: "systemPromptOptions",
    }];
  });
}

function decodeXmlEntities(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ? decodeXmlEntities(match[1].trim()) : undefined;
}

export function collectSkillsFromXml(systemPrompt: string): SkillRecord[] {
  const root = systemPrompt.match(/<available_skills>([\s\S]*?)<\/available_skills>/i);
  if (!root) return [];
  const skills: SkillRecord[] = [];
  for (const match of root[1].matchAll(/<skill>([\s\S]*?)<\/skill>/gi)) {
    const name = extractTag(match[1], "name");
    if (!name) continue;
    skills.push({ name, description: extractTag(match[1], "description"), location: extractTag(match[1], "location"), source: "xml" });
  }
  return skills;
}

export function mergeSkills(records: SkillRecord[]): Map<string, SkillRecord> {
  const merged = new Map<string, SkillRecord>();
  for (const skill of records) {
    const key = normalizeName(skill.name);
    const existing = merged.get(key);
    merged.set(key, existing ? {
      name: existing.name,
      description: existing.description ?? skill.description,
      location: existing.location ?? skill.location,
      source: existing.source === "systemPromptOptions" ? existing.source : skill.source,
    } : skill);
  }
  return merged;
}

export function sortedSkills(skills: Map<string, SkillRecord>): SkillRecord[] {
  return [...skills.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findSkill(skills: Map<string, SkillRecord>, name: string): SkillRecord | undefined {
  const key = normalizeName(name);
  const exact = skills.get(key);
  if (exact) return exact;
  const matches = sortedSkills(skills).filter((skill) => normalizeName(skill.name).includes(key));
  return matches.length === 1 ? matches[0] : undefined;
}

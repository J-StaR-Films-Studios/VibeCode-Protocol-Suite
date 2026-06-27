import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const parsed = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!parsed) continue;
    data[parsed[1]] = parsed[2].replace(/^['\"]|['\"]$/g, "").trim();
  }
  return data;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readSkillFile(filePath: string): Promise<SkillRecord | undefined> {
  try {
    const text = await readFile(filePath, "utf8");
    const frontmatter = parseFrontmatter(text);
    const name = frontmatter.name?.trim() || path.basename(path.dirname(filePath));
    const description = frontmatter.description?.trim();
    if (!name || !description) return undefined;
    return { name, description, location: filePath, source: "filesystem" };
  } catch {
    return undefined;
  }
}

async function collectSkillFiles(root: string, directMarkdownFiles = false, depth = 0, maxDepth = 8): Promise<string[]> {
  if (depth > maxDepth || !await pathExists(root)) return [];
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }> = [];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  if (await pathExists(path.join(root, "SKILL.md"))) files.push(path.join(root, "SKILL.md"));
  if (directMarkdownFiles && depth === 0) {
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) files.push(path.join(root, entry.name));
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if ([".git", "node_modules"].includes(entry.name)) continue;
    files.push(...await collectSkillFiles(path.join(root, entry.name), false, depth + 1, maxDepth));
  }
  return [...new Set(files)];
}

async function collectPackageSkillRoots(nodeModulesRoot: string): Promise<string[]> {
  if (!await pathExists(nodeModulesRoot)) return [];
  const roots: string[] = [];
  let packages: Array<{ name: string; isDirectory(): boolean }> = [];
  try {
    packages = await readdir(nodeModulesRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const pkg of packages) {
    if (!pkg.isDirectory()) continue;
    if (pkg.name.startsWith("@")) {
      const scopeRoot = path.join(nodeModulesRoot, pkg.name);
      let scoped: Array<{ name: string; isDirectory(): boolean }> = [];
      try {
        scoped = await readdir(scopeRoot, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const scopedPkg of scoped) if (scopedPkg.isDirectory()) roots.push(path.join(scopeRoot, scopedPkg.name, "skills"));
      continue;
    }
    roots.push(path.join(nodeModulesRoot, pkg.name, "skills"));
  }
  return roots;
}

function ancestorSkillRoots(cwd: string): string[] {
  const roots: string[] = [];
  let current = path.resolve(cwd || process.cwd());
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    roots.push(path.join(current, ".agents", "skills"));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  roots.push(path.resolve(cwd || process.cwd(), ".pi", "skills"));
  return roots;
}

export async function discoverSkillsFromFilesystem(cwd = process.cwd()): Promise<SkillRecord[]> {
  const home = os.homedir();
  const roots = [
    { root: path.join(home, ".pi", "agent", "skills"), directMarkdownFiles: true },
    { root: path.join(home, ".agents", "skills"), directMarkdownFiles: false },
    ...ancestorSkillRoots(cwd).map((root) => ({ root, directMarkdownFiles: root.endsWith(`${path.sep}.pi${path.sep}skills`) })),
    ...(await collectPackageSkillRoots(path.join(home, ".pi", "agent", "npm", "node_modules"))).map((root) => ({ root, directMarkdownFiles: false })),
  ];
  const skillFiles = new Set<string>();
  for (const { root, directMarkdownFiles } of roots) {
    for (const file of await collectSkillFiles(root, directMarkdownFiles)) skillFiles.add(file);
  }
  const skills = await Promise.all([...skillFiles].map(readSkillFile));
  return skills.filter((skill): skill is SkillRecord => Boolean(skill));
}

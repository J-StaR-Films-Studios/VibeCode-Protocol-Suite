import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

type SkillRecord = {
  name: string;
  description?: string;
  location?: string;
  source: "systemPromptOptions" | "xml" | "tool";
};

type CandidateContext = {
  name: string;
  score: number;
  confidence: "high" | "medium";
  suggestedAction: "skill_load" | "skill_manifest";
  reasons: string[];
};

type ContextReport = {
  timestamp: string;
  cwd: string;
  userPrompt: string;
  skillCount: number;
  candidates: CandidateContext[];
  loadedByTool: string[];
  promptRewrite: {
    attempted: boolean;
    changed: boolean;
    originalLength: number;
    rewrittenLength: number;
    removedSections: string[];
    warnings: string[];
  };
  toolCalls: {
    skillIndex: number;
    skillManifest: number;
    skillLoad: number;
    contextReport: number;
  };
};

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "this",
  "to",
  "with",
  "when",
  "you",
]);

const TRIGGER_SEEDS: Record<string, string[]> = {
  "optimize-agent-context": [
    "system prompt",
    "context bloat",
    "agent instructions",
    "prompt kernel",
    "context management",
  ],
  takomi: ["takomi", "genesis", "design", "build", "orchestration", "vibecode"],
  "pi-subagents": ["subagent", "subagents", "delegate", "parallel agents", "oauthrouter"],
  "skill-creator": ["create skill", "new skill", "skill.md", "agent skill"],
};

let latestSkills = new Map<string, SkillRecord>();
let lastReport: ContextReport = createEmptyReport();

function createEmptyReport(): ContextReport {
  return {
    timestamp: new Date().toISOString(),
    cwd: "",
    userPrompt: "",
    skillCount: 0,
    candidates: [],
    loadedByTool: [],
    promptRewrite: {
      attempted: false,
      changed: false,
      originalLength: 0,
      rewrittenLength: 0,
      removedSections: [],
      warnings: [],
    },
    toolCalls: {
      skillIndex: 0,
      skillManifest: 0,
      skillLoad: 0,
      contextReport: 0,
    },
  };
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function meaningfulWords(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

function getSkillName(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const name = record.name ?? record.id ?? record.title;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

function getSkillDescription(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const description = record.description ?? record.summary;
  return typeof description === "string" && description.trim() ? description.trim() : undefined;
}

function getSkillLocation(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const record = input as Record<string, unknown>;
  const location = record.location ?? record.path ?? record.file ?? record.skillPath;
  return typeof location === "string" && location.trim() ? location.trim() : undefined;
}

function collectSkillsFromOptions(options: unknown): SkillRecord[] {
  if (!options || typeof options !== "object") return [];
  const skills = (options as { skills?: unknown }).skills;
  const rawList = Array.isArray(skills)
    ? skills
    : skills && typeof skills === "object"
      ? Object.values(skills as Record<string, unknown>)
      : [];

  return rawList.flatMap((item): SkillRecord[] => {
    const name = getSkillName(item);
    if (!name) return [];
    return [
      {
        name,
        description: getSkillDescription(item),
        location: getSkillLocation(item),
        source: "systemPromptOptions",
      },
    ];
  });
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() ? decodeXmlEntities(match[1].trim()) : undefined;
}

function collectSkillsFromXml(systemPrompt: string): SkillRecord[] {
  const root = systemPrompt.match(/<available_skills>([\s\S]*?)<\/available_skills>/i);
  if (!root) return [];
  const skills: SkillRecord[] = [];
  const skillBlocks = root[1].matchAll(/<skill>([\s\S]*?)<\/skill>/gi);
  for (const match of skillBlocks) {
    const block = match[1];
    const name = extractTag(block, "name");
    if (!name) continue;
    skills.push({
      name,
      description: extractTag(block, "description"),
      location: extractTag(block, "location"),
      source: "xml",
    });
  }
  return skills;
}

function mergeSkills(records: SkillRecord[]): Map<string, SkillRecord> {
  const merged = new Map<string, SkillRecord>();
  for (const skill of records) {
    const key = normalizeSkillName(skill.name);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, skill);
      continue;
    }
    merged.set(key, {
      name: existing.name,
      description: existing.description ?? skill.description,
      location: existing.location ?? skill.location,
      source: existing.source === "systemPromptOptions" ? existing.source : skill.source,
    });
  }
  return merged;
}

function sortedSkills(): SkillRecord[] {
  return [...latestSkills.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function renderSkillIndex(skills: SkillRecord[]): string {
  if (skills.length === 0) return "Available skills (names only): none discovered.";
  return ["Available skills (names only):", ...skills.map((skill) => `- ${skill.name}`)].join("\n");
}

function renderProgressiveRule(): string {
  return [
    "Skill loading:",
    "- You are given a skill index containing skill names only.",
    "- For uncertain matches, request skill_manifest for likely skills; manifests include descriptions and locations.",
    "- If a skill is clearly relevant or the user names it directly, use skill_load without requesting a manifest first.",
    "- Load full skill instructions only for skills you will actually use.",
  ].join("\n");
}

function scoreSkill(prompt: string, skill: SkillRecord): CandidateContext | undefined {
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

  const descriptionWords = meaningfulWords(skill.description ?? "").slice(0, 40);
  const matchedDescriptionWords = [...new Set(descriptionWords.filter((word) => promptNorm.includes(word)))];
  if (matchedDescriptionWords.length > 0) {
    score += Math.min(40, matchedDescriptionWords.length * 10);
    reasons.push(`description keywords: ${matchedDescriptionWords.slice(0, 5).join(", ")}`);
  }

  for (const trigger of TRIGGER_SEEDS[normalizeSkillName(skill.name)] ?? []) {
    if (promptNorm.includes(normalizeText(trigger))) {
      score += 20;
      reasons.push(`trigger: ${trigger}`);
    }
  }

  if (score < 40) return undefined;
  const confidence = score >= 100 ? "high" : "medium";
  return {
    name: skill.name,
    score,
    confidence,
    suggestedAction: confidence === "high" ? "skill_load" : "skill_manifest",
    reasons,
  };
}

function findCandidates(prompt: string): CandidateContext[] {
  return sortedSkills()
    .map((skill) => scoreSkill(prompt, skill))
    .filter((candidate): candidate is CandidateContext => Boolean(candidate))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 5);
}

function renderCandidateHint(candidates: CandidateContext[]): string {
  if (candidates.length === 0) return "";
  return [
    "Potentially relevant skills:",
    ...candidates.map((candidate) =>
      `- ${candidate.name} — use ${candidate.suggestedAction} if relevant`,
    ),
  ].join("\n");
}

function rewriteSkillBlock(systemPrompt: string, skills: SkillRecord[], candidates: CandidateContext[]): {
  prompt: string;
  changed: boolean;
  removedSections: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const replacement = [
    renderSkillIndex(skills),
    renderProgressiveRule(),
    renderCandidateHint(candidates),
  ]
    .filter(Boolean)
    .join("\n\n");

  const skillBlockRegex = /<available_skills>[\s\S]*?<\/available_skills>/i;
  if (!skillBlockRegex.test(systemPrompt)) {
    warnings.push("No <available_skills> block found; appended progressive skill guidance instead.");
    return {
      prompt: `${systemPrompt}\n\n${replacement}`,
      changed: true,
      removedSections: [],
      warnings,
    };
  }

  return {
    prompt: systemPrompt.replace(skillBlockRegex, replacement),
    changed: true,
    removedSections: ["available_skills descriptions"],
    warnings,
  };
}

function findSkill(name: string): SkillRecord | undefined {
  const key = normalizeSkillName(name);
  const exact = latestSkills.get(key);
  if (exact) return exact;
  const matches = sortedSkills().filter((skill) => normalizeSkillName(skill.name).includes(key));
  return matches.length === 1 ? matches[0] : undefined;
}

function renderManifest(names: string[]): string {
  if (names.length === 0) return "No skills requested.";
  return names
    .map((name) => {
      const skill = findSkill(name);
      if (!skill) {
        const close = sortedSkills()
          .filter((candidate) => normalizeSkillName(candidate.name).includes(normalizeSkillName(name).slice(0, 4)))
          .slice(0, 5)
          .map((candidate) => candidate.name);
        return [`Skill not found: ${name}`, close.length ? `Known close matches: ${close.join(", ")}` : ""].filter(Boolean).join("\n");
      }
      return [
        `Skill: ${skill.name}`,
        `Description: ${skill.description ?? "(no description discovered)"}`,
        `Location: ${skill.location ?? "(no location discovered)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

function renderReport(report: ContextReport, verbose = false): string {
  const lines = [
    "Takomi Context Manager Report",
    `- Timestamp: ${report.timestamp}`,
    `- CWD: ${report.cwd || "(unknown)"}`,
    `- Skill count: ${report.skillCount}`,
    `- Prompt rewrite attempted: ${report.promptRewrite.attempted ? "yes" : "no"}`,
    `- Prompt changed: ${report.promptRewrite.changed ? "yes" : "no"}`,
    `- Original prompt length: ${report.promptRewrite.originalLength} chars`,
    `- Rewritten prompt length: ${report.promptRewrite.rewrittenLength} chars`,
    `- Removed sections: ${report.promptRewrite.removedSections.join(", ") || "none"}`,
    `- Loaded by tool: ${report.loadedByTool.join(", ") || "none"}`,
    `- Tool calls: skill_index=${report.toolCalls.skillIndex}, skill_manifest=${report.toolCalls.skillManifest}, skill_load=${report.toolCalls.skillLoad}, context_report=${report.toolCalls.contextReport}`,
    `- Warnings: ${report.promptRewrite.warnings.join("; ") || "none"}`,
  ];

  if (report.candidates.length > 0) {
    lines.push("- Candidates:");
    for (const candidate of report.candidates) {
      lines.push(`  - ${candidate.name} (${candidate.confidence}, ${candidate.score}): ${candidate.reasons.join("; ")}`);
    }
  } else {
    lines.push("- Candidates: none");
  }

  if (verbose) {
    lines.push("", "Skill Index:", ...sortedSkills().map((skill) => `- ${skill.name}`));
  }

  return lines.join("\n");
}

async function loadSkillContent(skill: SkillRecord): Promise<string> {
  if (!skill.location) {
    throw new Error(`Skill ${skill.name} has no discovered SKILL.md location.`);
  }
  const fileName = path.basename(skill.location).toLowerCase();
  if (fileName !== "skill.md" && !skill.location.toLowerCase().endsWith(".md")) {
    throw new Error(`Refusing to load non-markdown skill location: ${skill.location}`);
  }
  return readFile(skill.location, "utf8");
}

export default function takomiContextManager(pi: ExtensionAPI) {
  pi.registerTool({
    name: "skill_index",
    label: "Skill Index",
    description: "Return the available skill names only. Use this to inspect capability names without loading descriptions or full instructions.",
    promptSnippet: "List available skill names only for progressive skill loading",
    promptGuidelines: [
      "Use skill_index when you need to inspect available skill names without loading descriptions or full skill instructions.",
    ],
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      lastReport.cwd = ctx.cwd;
      lastReport.toolCalls.skillIndex += 1;
      return {
        content: [{ type: "text", text: renderSkillIndex(sortedSkills()) }],
        details: { skillCount: latestSkills.size },
      };
    },
  });

  pi.registerTool({
    name: "skill_manifest",
    label: "Skill Manifest",
    description: "Return descriptions and locations for selected skills without loading full SKILL.md instructions.",
    promptSnippet: "Show selected skill descriptions and locations without full instructions",
    promptGuidelines: [
      "Use skill_manifest for uncertain skill matches before loading full skill instructions.",
      "Use skill_manifest with multiple skill names when comparing likely relevant skills.",
    ],
    parameters: Type.Object({
      skills: Type.Array(Type.String({ description: "Skill name to inspect" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      lastReport.cwd = ctx.cwd;
      lastReport.toolCalls.skillManifest += 1;
      return {
        content: [{ type: "text", text: renderManifest(params.skills) }],
        details: { requested: params.skills },
      };
    },
  });

  pi.registerTool({
    name: "skill_load",
    label: "Skill Load",
    description: "Load the full SKILL.md content for one selected skill that will actually be used.",
    promptSnippet: "Load full SKILL.md instructions for one selected skill",
    promptGuidelines: [
      "Use skill_load only when a skill is clearly relevant or the user names the skill directly.",
      "Do not use skill_load just to browse; use skill_manifest first when uncertain.",
    ],
    parameters: Type.Object({
      skill: Type.String({ description: "Exact skill name to load" }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      lastReport.cwd = ctx.cwd;
      lastReport.toolCalls.skillLoad += 1;
      const skill = findSkill(params.skill);
      if (!skill) {
        return {
          content: [{ type: "text", text: renderManifest([params.skill]) }],
          details: { found: false, requested: params.skill },
          isError: true,
        };
      }
      try {
        const content = await loadSkillContent(skill);
        lastReport.loadedByTool.push(skill.name);
        return {
          content: [
            {
              type: "text",
              text: [`Skill: ${skill.name}`, `Location: ${skill.location}`, "", content].join("\n"),
            },
          ],
          details: { found: true, skill: skill.name, location: skill.location },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: message }],
          details: { found: true, skill: skill.name, error: message },
          isError: true,
        };
      }
    },
  });

  pi.registerTool({
    name: "context_report",
    label: "Context Report",
    description: "Show takomi-context-manager diagnostics for prompt rewriting, candidates, and progressive skill loading.",
    promptSnippet: "Show context manager diagnostics and prompt composition decisions",
    parameters: Type.Object({
      verbose: Type.Optional(Type.Boolean({ description: "Include skill index in the report" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      lastReport.cwd = ctx.cwd;
      lastReport.toolCalls.contextReport += 1;
      return {
        content: [{ type: "text", text: renderReport(lastReport, params.verbose ?? false) }],
        details: lastReport,
      };
    },
  });

  pi.registerCommand("context-report", {
    description: "Show takomi-context-manager diagnostics",
    handler: async (_args, ctx) => {
      ctx.ui.notify(renderReport(lastReport, true), "info");
    },
  });

  pi.on("before_agent_start", async (event, ctx) => {
    const optionSkills = collectSkillsFromOptions(event.systemPromptOptions);
    const xmlSkills = collectSkillsFromXml(event.systemPrompt);
    latestSkills = mergeSkills([...optionSkills, ...xmlSkills]);

    const candidates = findCandidates(event.prompt);
    const rewrite = rewriteSkillBlock(event.systemPrompt, sortedSkills(), candidates);
    lastReport = {
      ...lastReport,
      timestamp: new Date().toISOString(),
      cwd: ctx.cwd,
      userPrompt: event.prompt,
      skillCount: latestSkills.size,
      candidates,
      promptRewrite: {
        attempted: true,
        changed: rewrite.changed,
        originalLength: event.systemPrompt.length,
        rewrittenLength: rewrite.prompt.length,
        removedSections: rewrite.removedSections,
        warnings: rewrite.warnings,
      },
    };

    return { systemPrompt: rewrite.prompt };
  });
}

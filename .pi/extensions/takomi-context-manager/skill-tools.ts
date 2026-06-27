import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { discoverSkillsFromFilesystem, findSkill, mergeSkills, normalizeName, sortedSkills } from "./skill-registry";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";

function renderSkillIndex(state: ContextManagerState): string {
  const skills = sortedSkills(state.skills);
  if (skills.length === 0) return "Available skills (names only): none discovered.";
  return ["Available skills (names only):", ...skills.map((skill) => `- ${skill.name}`)].join("\n");
}

function renderManifest(state: ContextManagerState, names: string[]): string {
  if (names.length === 0) return "No skills requested.";
  return names.map((name) => {
    const skill = findSkill(state.skills, name);
    if (!skill) {
      const close = sortedSkills(state.skills).filter((candidate) => normalizeName(candidate.name).includes(normalizeName(name).slice(0, 4))).slice(0, 5).map((candidate) => candidate.name);
      return [`Skill not found: ${name}`, close.length ? `Known close matches: ${close.join(", ")}` : ""].filter(Boolean).join("\n");
    }
    return [`Skill: ${skill.name}`, `Description: ${skill.description ?? "(no description discovered)"}`, `Location: ${skill.location ?? "(no location discovered)"}`].join("\n");
  }).join("\n\n");
}

async function loadSkillContent(location: string): Promise<string> {
  const fileName = path.basename(location).toLowerCase();
  if (fileName !== "skill.md" && !location.toLowerCase().endsWith(".md")) throw new Error(`Refusing to load non-markdown skill location: ${location}`);
  return readFile(location, "utf8");
}

async function ensureSkillsDiscovered(state: ContextManagerState, cwd: string): Promise<void> {
  if (state.skills.size > 0) return;
  state.skills = mergeSkills(await discoverSkillsFromFilesystem(cwd));
  state.report.skillCount = state.skills.size;
}

export function registerSkillTools(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "skill_index",
    label: "Skill Index",
    description: "Return the available skill names only. Use this to inspect capability names without loading descriptions or full instructions.",
    promptSnippet: "List available skill names only for progressive skill loading",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      await ensureSkillsDiscovered(state, ctx.cwd);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.skillIndex += 1;
      persistReportSnapshot(pi, state, "skill_index");
      return { content: [{ type: "text", text: renderSkillIndex(state) }], details: { skillCount: state.skills.size } };
    },
  });

  pi.registerTool({
    name: "skill_manifest",
    label: "Skill Manifest",
    description: "Return descriptions and locations for selected skills without loading full SKILL.md instructions.",
    promptSnippet: "Show selected skill descriptions and locations without full instructions",
    parameters: Type.Object({ skills: Type.Array(Type.String({ description: "Skill name to inspect" })) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      await ensureSkillsDiscovered(state, ctx.cwd);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.skillManifest += 1;
      persistReportSnapshot(pi, state, "skill_manifest");
      return { content: [{ type: "text", text: renderManifest(state, params.skills) }], details: { requested: params.skills } };
    },
  });

  pi.registerTool({
    name: "skill_load",
    label: "Skill Load",
    description: "Load the full SKILL.md content for one selected skill that will actually be used.",
    promptSnippet: "Load full SKILL.md instructions for one selected skill",
    parameters: Type.Object({ skill: Type.String({ description: "Exact skill name to load" }) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      await ensureSkillsDiscovered(state, ctx.cwd);
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.skillLoad += 1;
      const skill = findSkill(state.skills, params.skill);
      if (!skill?.location) {
        persistReportSnapshot(pi, state, "skill_load_not_found");
        return { content: [{ type: "text", text: renderManifest(state, [params.skill]) }], details: { found: false, requested: params.skill }, isError: true };
      }
      try {
        const content = await loadSkillContent(skill.location);
        state.report.loadedByTool = [...new Set([...state.report.loadedByTool, skill.name])].sort();
        persistReportSnapshot(pi, state, "skill_load");
        return { content: [{ type: "text", text: [`Skill: ${skill.name}`, `Location: ${skill.location}`, "", content].join("\n") }], details: { found: true, skill: skill.name, location: skill.location } };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        persistReportSnapshot(pi, state, "skill_load_error");
        return { content: [{ type: "text", text: message }], details: { found: true, skill: skill.name, error: message }, isError: true };
      }
    },
  });
}

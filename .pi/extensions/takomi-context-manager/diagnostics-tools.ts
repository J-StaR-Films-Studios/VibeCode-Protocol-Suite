import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { renderReport, type ContextReportMode } from "./diagnostics";
import { discoverSkillsFromFilesystem, mergeSkills } from "./skill-registry";
import { persistReportSnapshot, restoreReportFromSession } from "./session-state";

export function registerDiagnostics(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "context_report",
    label: "Context Report",
    description: "Show takomi-context-manager diagnostics. Defaults to compact summary; use mode='verbose' for full details or mode='problems' for attention-only output.",
    promptSnippet: "Show context manager diagnostics and prompt composition decisions",
    parameters: Type.Object({
      mode: Type.Optional(Type.Union([
        Type.Literal("summary"),
        Type.Literal("verbose"),
        Type.Literal("problems"),
      ], { description: "Report layout mode. Defaults to summary. Use verbose for full diagnostics or problems for attention-only output." })),
      verbose: Type.Optional(Type.Boolean({ description: "Deprecated compatibility alias for mode='verbose'." })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      restoreReportFromSession(state, ctx);
      if (state.skills.size === 0) state.skills = mergeSkills(await discoverSkillsFromFilesystem(ctx.cwd));
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.skillCount = state.skills.size;
      state.report.toolCalls.contextReport += 1;
      persistReportSnapshot(pi, state, "context_report");
      const mode = (params.verbose ? "verbose" : params.mode ?? "summary") as ContextReportMode;
      return { content: [{ type: "text", text: renderReport(state, mode) }], details: { ...state.report, mode } };
    },
  });

  pi.registerCommand("context-report", {
    description: "Show takomi-context-manager diagnostics. Optional args: summary, verbose, problems",
    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const modes: AutocompleteItem[] = [
        { value: "summary", label: "summary — compact health report" },
        { value: "verbose", label: "verbose — full diagnostics" },
        { value: "problems", label: "problems — only issues requiring attention" },
      ];
      const normalized = prefix.trim().toLowerCase();
      const filtered = modes.filter((mode) => mode.value.startsWith(normalized));
      return filtered.length ? filtered : null;
    },
    handler: async (args, ctx) => {
      restoreReportFromSession(state, ctx);
      if (state.skills.size === 0) state.skills = mergeSkills(await discoverSkillsFromFilesystem(ctx.cwd));
      state.report.timestamp = new Date().toISOString();
      state.report.cwd = ctx.cwd;
      state.report.skillCount = state.skills.size;
      state.report.toolCalls.contextReport += 1;
      persistReportSnapshot(pi, state, "context-report-command");
      const requested = args.trim();
      const mode: ContextReportMode = requested === "verbose" || requested === "problems" || requested === "summary" ? requested : "summary";
      ctx.ui.notify(renderReport(state, mode), "info");
    },
  });
}

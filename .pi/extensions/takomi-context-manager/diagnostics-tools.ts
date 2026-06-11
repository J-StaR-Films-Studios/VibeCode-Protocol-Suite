import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ContextManagerState } from "./state";
import { renderReport } from "./diagnostics";

export function registerDiagnostics(pi: ExtensionAPI, state: ContextManagerState): void {
  pi.registerTool({
    name: "context_report",
    label: "Context Report",
    description: "Show takomi-context-manager diagnostics for prompt rewriting, candidates, policies, gates, and progressive skill loading.",
    promptSnippet: "Show context manager diagnostics and prompt composition decisions",
    parameters: Type.Object({ verbose: Type.Optional(Type.Boolean({ description: "Include skill and policy indexes in the report" })) }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.contextReport += 1;
      return { content: [{ type: "text", text: renderReport(state, params.verbose ?? false) }], details: state.report };
    },
  });

  pi.registerCommand("context-report", {
    description: "Show takomi-context-manager diagnostics",
    handler: async (_args, ctx) => {
      state.report.cwd = ctx.cwd;
      state.report.toolCalls.contextReport += 1;
      ctx.ui.notify(renderReport(state, true), "info");
    },
  });
}

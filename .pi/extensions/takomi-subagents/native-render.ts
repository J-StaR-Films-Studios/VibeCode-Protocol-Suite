import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import type { TakomiSubagentToolParams } from "./tool-runner";
import { renderNativeSubagentResult, type Details } from "./pi-subagents-internal";

type ToolResult = AgentToolResult<Details>;

function taskList(params: TakomiSubagentToolParams): Array<{ agent: string; task: string }> {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent || params.task) return [{ agent: params.agent ?? "...", task: params.task ?? "..." }];
  return [];
}

export function renderTakomiSubagentCall(params: TakomiSubagentToolParams, theme: Theme) {
  const tasks = taskList(params);
  const mode = params.chain?.length ? "chain" : params.tasks?.length ? "parallel" : "single";
  if (tasks.length === 1) {
    return new Text(
      `${theme.fg("toolTitle", theme.bold("takomi_subagent "))}${theme.fg("accent", tasks[0]?.agent || "?")}`,
      0,
      0,
    );
  }
  return new Text(
    `${theme.fg("toolTitle", theme.bold("takomi_subagent "))}${mode} (${tasks.length})`,
    0,
    0,
  );
}

function resultText(result: ToolResult): string {
  return typeof (result as any)?.content === "string"
    ? (result as any).content
    : Array.isArray((result as any)?.content)
      ? (result as any).content.map((part: any) => part?.text ?? "").filter(Boolean).join("\n")
      : JSON.stringify((result as any)?.details ?? {}, null, 2);
}

function summarizeCollapsedResult(text: string, status: string, theme: Theme): string {
  const policyMatch = text.match(/Required policies:\n((?:- .+\n?)+)/);
  const policies = policyMatch?.[1]
    ?.split("\n")
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter(Boolean) ?? [];
  const lineCount = text ? text.split(/\r?\n/).length : 0;
  const label = policies.length > 0
    ? `policy context loaded: ${policies.join(", ")}`
    : `${lineCount} result line${lineCount === 1 ? "" : "s"} hidden`;
  const icon = status === "failed" ? "⚠" : "✓";
  const color = status === "failed" ? "warning" : "success";
  return `${theme.fg(color, `${icon} takomi_subagent ${status}`)}${theme.fg("dim", ` · ${label} (ctrl+o to expand)`)}`;
}

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme, context: any): any {
  const native = renderNativeSubagentResult(result, options, theme, context);
  if (native) return native;

  const status = (result as any)?.isError ? "failed" : "completed";
  const text = resultText(result);
  if (!options.expanded && !options.isPartial) {
    return new Text(summarizeCollapsedResult(text, status, theme), 0, 0);
  }
  return new Text(`${theme.fg("toolTitle", theme.bold(`takomi_subagent ${status}`))}\n${text || "No result content."}`, 0, 0);
}

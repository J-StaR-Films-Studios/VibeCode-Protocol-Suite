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
  const icon = status === "failed" ? "⚠" : status === "running" ? "…" : "✓";
  const color = status === "failed" ? "warning" : status === "running" ? "accent" : "success";
  return `${theme.fg(color, `${icon} takomi_subagent ${status}`)}${theme.fg("dim", ` · ${label} (ctrl+o to expand)`)}`;
}

function recentOutputLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).slice(-3);
  if (typeof value === "string") return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-3);
  return [];
}

function livePartialText(result: ToolResult, theme: Theme): string {
  const details = (result as any)?.details ?? {};
  const results = Array.isArray(details.results) ? details.results : [];
  const progress = Array.isArray(details.progress) ? details.progress : [];
  const lines = [
    theme.fg("toolTitle", theme.bold("takomi_subagent running")),
    theme.fg("dim", "Live detail is bounded while streaming so manual scroll/ctrl+o does not jump on every token."),
  ];

  const rows = results.length ? results : progress;
  if (!rows.length) {
    const text = resultText(result).split(/\r?\n/).find((line) => line.trim())?.trim();
    lines.push(theme.fg("dim", text || "Waiting for subagent progress…"));
    return lines.join("\n");
  }

  rows.slice(0, 6).forEach((row: any, index: number) => {
    const status = row.status ?? (row.exitCode === 0 ? "completed" : row.exitCode === -1 ? "running" : row.exitCode === undefined ? "running" : "failed");
    const agent = row.agent ?? `task ${index + 1}`;
    const task = String(row.task ?? "").replace(/\s+/g, " ").trim();
    const currentTool = row.currentTool ?? row.progress?.currentTool;
    const tokens = row.tokens ?? row.progress?.tokens ?? row.usage?.output;
    const tail = recentOutputLines(row.recentOutput ?? row.progress?.recentOutput ?? row.finalOutput ?? row.output);
    lines.push(theme.fg("accent", `${index + 1}. ${agent} ${theme.fg("dim", `[${status}]`)}`));
    if (task) lines.push(theme.fg("dim", `   ${task.slice(0, 140)}${task.length > 140 ? "…" : ""}`));
    if (currentTool || tokens) lines.push(theme.fg("muted", `   ${[currentTool ? `tool:${currentTool}` : "", tokens ? `tokens:${tokens}` : ""].filter(Boolean).join(" | ")}`));
    for (const line of tail) lines.push(theme.fg("dim", `   › ${line.slice(0, 160)}${line.length > 160 ? "…" : ""}`));
  });
  if (rows.length > 6) lines.push(theme.fg("muted", `… ${rows.length - 6} more running item${rows.length - 6 === 1 ? "" : "s"}`));
  lines.push(theme.fg("muted", "Final output will use the normal expandable native subagent renderer."));
  return lines.join("\n");
}

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme, context: any): any {
  const status = (result as any)?.isError ? "failed" : options.isPartial ? "running" : "completed";
  const text = resultText(result);

  if (options.isPartial) {
    if (options.expanded) return new Text(livePartialText(result, theme), 0, 0);
    return new Text(summarizeCollapsedResult(text, status, theme), 0, 0);
  }

  const native = renderNativeSubagentResult(result, options, theme, context);
  if (native) return native;

  if (!options.expanded) {
    return new Text(summarizeCollapsedResult(text, status, theme), 0, 0);
  }
  return new Text(`${theme.fg("toolTitle", theme.bold(`takomi_subagent ${status}`))}\n${text || "No result content."}`, 0, 0);
}

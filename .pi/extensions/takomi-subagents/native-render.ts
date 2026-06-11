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

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme, context: any): any {
  const native = renderNativeSubagentResult(result, options, theme, context);
  if (native) return native;

  const status = (result as any)?.isError ? "failed" : "completed";
  const text = typeof (result as any)?.content === "string"
    ? (result as any).content
    : Array.isArray((result as any)?.content)
      ? (result as any).content.map((part: any) => part?.text ?? "").filter(Boolean).join("\n")
      : JSON.stringify((result as any)?.details ?? {}, null, 2);
  return new Text(`${theme.fg("toolTitle", theme.bold(`takomi_subagent ${status}`))}\n${text || "No result content."}`, 0, 0);
}

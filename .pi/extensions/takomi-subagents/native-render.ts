import { renderSubagentResult, syncResultAnimation } from "pi-subagents/src/tui/render";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Details } from "pi-subagents/src/shared/types";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { TakomiSubagentToolParams } from "./tool-runner";

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

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme, context: any) {
  syncResultAnimation(result, context);
  return renderSubagentResult(result, { expanded: options.expanded ?? false }, theme);
}

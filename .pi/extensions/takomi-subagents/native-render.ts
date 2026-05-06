import type { Theme } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";
import { Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { TakomiDispatchResult } from "./dispatch";
import type { TakomiSubagentToolParams } from "./tool-runner";

type ToolResult = {
  content?: Array<{ type: string; text?: string }>;
  details?: {
    results?: TakomiDispatchResult[];
    mode?: "single" | "parallel" | "chain";
    agentScope?: string;
  };
  isError?: boolean;
};

function shorten(text: string | undefined, max = 72): string {
  const value = text?.replace(/\s+/g, " ").trim() || "...";
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function firstLines(text: string, limit: number): string {
  return text.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(0, limit).join("\n");
}

function taskList(params: TakomiSubagentToolParams): Array<{ agent: string; task: string }> {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent || params.task) return [{ agent: params.agent ?? "...", task: params.task ?? "..." }];
  return [];
}

export function renderTakomiSubagentCall(params: TakomiSubagentToolParams, theme: Theme) {
  const tasks = taskList(params);
  const mode = params.chain?.length ? "chain" : params.tasks?.length ? "parallel" : "single";
  const scope = params.agentScope ?? "both";
  let text = theme.fg("toolTitle", theme.bold("Takomi ")) + theme.fg("accent", mode) + theme.fg("muted", ` [${scope}]`);

  for (const [index, task] of tasks.slice(0, 3).entries()) {
    const prefix = mode === "chain" ? `${index + 1}. ` : "";
    text += `\n  ${theme.fg("accent", `${prefix}${task.agent}`)}${theme.fg("dim", ` ${shorten(task.task, 54)}`)}`;
  }
  if (tasks.length > 3) text += `\n  ${theme.fg("muted", `... +${tasks.length - 3} more`)}`;
  return new Text(text, 0, 0);
}

function resultHeader(result: TakomiDispatchResult, theme: Theme): string {
  const running = result.code === -1;
  const failed = result.code !== 0 && !running;
  const status = running ? theme.fg("warning", "[running]") : failed ? theme.fg("error", "[failed]") : theme.fg("success", "[done]");
  const model = result.model ? theme.fg("muted", ` ${result.model}`) : "";
  const thinking = result.thinking ? theme.fg("muted", ` think:${result.thinking}`) : "";
  return `${status} ${theme.fg("toolTitle", theme.bold(result.agent))}${model}${thinking}`;
}

function renderSingle(result: TakomiDispatchResult, expanded: boolean, theme: Theme) {
  const output = result.output || result.stderr || "No output returned.";
  if (!expanded) {
    const color = result.code === -1 || result.code === 0 ? "toolOutput" : "error";
    return new Text(`${resultHeader(result, theme)}\n${theme.fg(color, firstLines(output, 8))}\n${theme.fg("muted", "(Ctrl+O to expand live output)")}`, 0, 0);
  }

  const container = new Container();
  container.addChild(new Text(resultHeader(result, theme), 0, 0));
  if (result.warning) container.addChild(new Text(theme.fg("warning", result.warning), 0, 0));
  if (result.preflight) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("muted", "Model preflight"), 0, 0));
    container.addChild(new Text(theme.fg("dim", result.preflight), 0, 0));
  }
  container.addChild(new Spacer(1));
  container.addChild(new Markdown(output.trim(), 0, 0, getMarkdownTheme()));
  return container;
}

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme) {
  const details = result.details;
  const results = details?.results ?? [];
  if (results.length === 0) {
    const text = result.content?.find((item) => item.type === "text")?.text ?? "(no output)";
    return new Text(text, 0, 0);
  }

  if (results.length === 1 && details?.mode !== "parallel" && details?.mode !== "chain") {
    return renderSingle(results[0], Boolean(options.expanded), theme);
  }

  const completed = results.filter((item) => item.code === 0).length;
  const running = results.filter((item) => item.code === -1).length;
  const failed = results.filter((item) => item.code !== 0 && item.code !== -1).length;
  const mode = details?.mode ?? "parallel";
  const state = running ? `[running ${running}]` : failed ? "[mixed]" : "[done]";
  const header = `${theme.fg(failed || running ? "warning" : "success", state)} ${theme.fg("toolTitle", theme.bold(`Takomi ${mode}`))} ${theme.fg("accent", `${completed}/${results.length}`)}`;

  if (options.expanded) {
    const container = new Container();
    container.addChild(new Text(header, 0, 0));
    for (const item of results) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(resultHeader(item, theme), 0, 0));
      container.addChild(new Markdown((item.output || item.stderr || "No output returned.").trim(), 0, 0, getMarkdownTheme()));
    }
    return container;
  }

  const text = [
    header,
    ...results.map((item) => {
      const color = item.code === -1 || item.code === 0 ? "toolOutput" : "error";
      return `${resultHeader(item, theme)}\n${theme.fg(color, firstLines(item.output || item.stderr || "No output returned.", 5))}`;
    }),
    theme.fg("muted", "(Ctrl+O to expand)"),
  ].join("\n\n");
  return new Text(text, 0, 0);
}

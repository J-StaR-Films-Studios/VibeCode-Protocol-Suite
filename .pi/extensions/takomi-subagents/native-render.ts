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
    plan?: unknown;
  };
  isError?: boolean;
};

function shorten(text: string | undefined, max = 72): string {
  const value = text?.replace(/\s+/g, " ").trim() || "...";
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

function firstLine(text: string | undefined): string {
  return text?.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

function taskList(params: TakomiSubagentToolParams): Array<{ agent: string; task: string }> {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent || params.task) return [{ agent: params.agent ?? "...", task: params.task ?? "..." }];
  return [];
}

function resultGlyph(result: TakomiDispatchResult, theme: Theme): string {
  if (result.code === -1) return theme.fg("accent", "⠧");
  if (result.code === 0) return theme.fg("success", "✓");
  return theme.fg("error", "✗");
}

function resultStatus(result: TakomiDispatchResult): string {
  if (result.code === -1) return "running";
  if (result.code === 0) return "done";
  return "failed";
}

function resultStats(result: TakomiDispatchResult, theme: Theme): string {
  const parts = [
    result.model || "",
    result.thinking ? `think:${result.thinking}` : "",
  ].filter(Boolean);
  return parts.length ? theme.fg("dim", parts.join(" · ")) : "";
}

function compactSingle(result: TakomiDispatchResult, theme: Theme): Text {
  const output = firstLine(result.output || result.stderr || "No output returned.");
  const stats = resultStats(result, theme);
  const header = `${resultGlyph(result, theme)} ${theme.fg("toolTitle", theme.bold(result.agent))}${stats ? ` ${theme.fg("dim", "·")} ${stats}` : ""}`;
  const status = theme.fg(result.code === 0 ? "dim" : result.code === -1 ? "accent" : "error", `  ⎿  ${resultStatus(result)}`);
  const preview = output ? `\n${theme.fg("dim", `     ${shorten(output, 92)}`)}` : "";
  const hint = result.code === -1 ? `\n${theme.fg("accent", "  Press Ctrl+O for live detail")}` : "";
  return new Text(`${header}\n${status}${preview}${hint}`, 0, 0);
}

function expandedSingle(result: TakomiDispatchResult, theme: Theme): Container {
  const output = result.output || result.stderr || "No output returned.";
  const container = new Container();
  const header = `${resultGlyph(result, theme)} ${theme.fg("toolTitle", theme.bold(result.agent))}`;
  const meta = [
    `status: ${resultStatus(result)}`,
    result.model ? `model: ${result.model}` : "",
    result.thinking ? `thinking: ${result.thinking}` : "",
    result.workflow ? `workflow: ${result.workflow}` : "",
    result.conversationId ? `thread: ${result.conversationId}` : "",
  ].filter(Boolean).join(" · ");

  container.addChild(new Text(header, 0, 0));
  if (meta) container.addChild(new Text(theme.fg("dim", meta), 0, 0));
  if (result.warning) container.addChild(new Text(theme.fg("warning", result.warning), 0, 0));
  if (result.preflight) {
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg("dim", result.preflight), 0, 0));
  }
  container.addChild(new Spacer(1));
  container.addChild(new Markdown(output.trim(), 0, 0, getMarkdownTheme()));
  return container;
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

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme) {
  const details = result.details;
  const results = details?.results ?? [];

  if (results.length === 0) {
    const text = result.content?.find((item) => item.type === "text")?.text ?? "(no output)";
    return new Text(text, 0, 0);
  }

  if (results.length === 1 && details?.mode !== "parallel" && details?.mode !== "chain") {
    return options.expanded ? expandedSingle(results[0]!, theme) : compactSingle(results[0]!, theme);
  }

  const running = results.filter((item) => item.code === -1).length;
  const done = results.filter((item) => item.code === 0).length;
  const failed = results.filter((item) => item.code !== 0 && item.code !== -1).length;
  const mode = details?.mode ?? "parallel";
  const glyph = running ? theme.fg("accent", "⠧") : failed ? theme.fg("error", "✗") : theme.fg("success", "✓");
  const header = `${glyph} ${theme.fg("toolTitle", theme.bold(mode))} ${theme.fg("dim", `· ${done}/${results.length} done`)}`;

  if (!options.expanded) {
    const lines = [header];
    for (const [index, item] of results.entries()) {
      const preview = firstLine(item.output || item.stderr || "No output returned.");
      lines.push(`  ${resultGlyph(item, theme)} Agent ${index + 1}/${results.length}: ${theme.bold(item.agent)}`);
      if (preview) lines.push(theme.fg("dim", `    ⎿  ${shorten(preview, 88)}`));
    }
    if (running) lines.push(theme.fg("accent", "  Press Ctrl+O for live detail"));
    return new Text(lines.join("\n"), 0, 0);
  }

  const container = new Container();
  container.addChild(new Text(header, 0, 0));
  for (const [index, item] of results.entries()) {
    container.addChild(new Spacer(1));
    const meta = [
      `Agent ${index + 1}/${results.length}`,
      item.model || "",
      item.thinking ? `think:${item.thinking}` : "",
      item.workflow ? `workflow:${item.workflow}` : "",
    ].filter(Boolean).join(" · ");
    container.addChild(new Text(`${resultGlyph(item, theme)} ${theme.fg("toolTitle", theme.bold(item.agent))}`, 0, 0));
    if (meta) container.addChild(new Text(theme.fg("dim", meta), 0, 0));
    if (item.warning) container.addChild(new Text(theme.fg("warning", item.warning), 0, 0));
    container.addChild(new Markdown((item.output || item.stderr || "No output returned.").trim(), 0, 0, getMarkdownTheme()));
  }
  return container;
}

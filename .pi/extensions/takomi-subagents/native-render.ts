import { renderSubagentResult, syncResultAnimation } from "pi-subagents/src/tui/render";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { Details, SingleResult, AgentProgress } from "pi-subagents/src/shared/types";
import type { Theme } from "@mariozechner/pi-coding-agent";
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

function parseTakomiOutput(outputText: string) {
  const rawLines = outputText.split(/\r?\n/);
  const textLines: string[] = [];
  const recentTools: Array<{ tool: string; args: string; endMs: number }> = [];
  let currentTool: string | undefined;
  let currentToolArgs: string | undefined;

  for (const line of rawLines) {
    if (!line.trim()) continue;

    // 1. Check for tool lifecycle markers
    if (line.startsWith("Tool start: ")) {
      currentTool = line.replace("Tool start: ", "").trim();
      continue;
    }
    if (line.startsWith("Tool complete: ") || line.startsWith("Tool failed: ")) {
      const toolName = line.replace(/Tool (complete|failed): /, "").trim();
      recentTools.push({ tool: toolName, args: "", endMs: Date.now() });
      if (currentTool === toolName) {
        currentTool = undefined;
        currentToolArgs = undefined;
      }
      continue;
    }

    // 2. Handle JSON blobs (tool calls)
    const jsonStartIdx = line.indexOf('{"');
    if (jsonStartIdx !== -1) {
      const beforeJson = line.substring(0, jsonStartIdx).trim();
      if (beforeJson) textLines.push(beforeJson);

      const jsonPart = line.substring(jsonStartIdx);
      try {
        const parsed = JSON.parse(jsonPart);
        const toolName = parsed.tool || (parsed.command ? parsed.command.split(" ")[0] : undefined);
        if (toolName) {
          const args = parsed.args ? JSON.stringify(parsed.args) : (parsed.command || "");
          currentTool = toolName;
          currentToolArgs = args;
        }
      } catch (e) {
        if (jsonPart.trim().length > 1) {
          textLines.push(jsonPart);
        }
      }
      continue;
    }

    // 3. Skip lone brackets
    const trimmed = line.trim();
    if (trimmed === "{" || trimmed === "}") continue;

    // 4. Everything else is text (thoughts)
    textLines.push(line);
  }

  return { textLines, recentTools, currentTool, currentToolArgs };
}

export function renderTakomiSubagentResult(result: ToolResult, options: { expanded?: boolean; isPartial?: boolean }, theme: Theme, context: any) {
  const details = result.details;
  const results = details?.results ?? [];

  if (results.length === 0) {
    const text = result.content?.find((item) => item.type === "text")?.text ?? "(no output)";
    return new Text(text, 0, 0);
  }

  const mappedResults: SingleResult[] = results.map((r, i) => {
    const isRunning = r.code === -1;
    const outputText = r.output || r.stderr || "";
    const { textLines, recentTools, currentTool, currentToolArgs } = parseTakomiOutput(outputText);
    
    const recentOutput = textLines.slice(-5);

    const progress: AgentProgress | undefined = isRunning ? {
      index: i,
      agent: r.agent,
      status: "running",
      task: r.task || "",
      lastActivityAt: Date.now(),
      currentTool,
      currentToolArgs,
      currentToolStartedAt: currentTool ? Date.now() : undefined,
      recentTools,
      recentOutput,
      toolCount: recentTools.length + (currentTool ? 1 : 0),
      tokens: 0,
      durationMs: 0,
    } : {
      index: i,
      agent: r.agent,
      status: "completed", // Takomi results in mappedResults are usually final if code !== -1
      task: r.task || "",
      lastActivityAt: Date.now(),
      recentTools,
      recentOutput: [],
      toolCount: recentTools.length,
      tokens: 0,
      durationMs: 0,
    };

    return {
      agent: r.agent,
      task: r.task || "",
      exitCode: isRunning ? 0 : r.code,
      model: r.model,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      progress,
      truncation: isRunning ? undefined : {
        text: textLines.join("\n").replace(/\n/g, "  \n"),
        truncated: false
      }
    };
  });

  const mappedDetails: Details = {
    mode: details?.mode ?? "single",
    results: mappedResults,
    chainAgents: details?.mode === "chain" ? results.map(r => r.agent) : undefined,
  };

  const agentToolResult: AgentToolResult<Details> = {
    content: result.content as any || [],
    details: mappedDetails,
  };

  syncResultAnimation(agentToolResult, context);
  return renderSubagentResult(agentToolResult, { expanded: options.expanded ?? false }, theme);
}


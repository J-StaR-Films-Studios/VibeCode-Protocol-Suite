import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import type { TakomiSubagentRuntimeEvent } from "../takomi-runtime/subagent-types";
import type { TakomiDispatchResult } from "./run-types";

type ToolUpdate = (partial: {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}) => void;

type LiveTask = {
  agent: string;
  task: string;
  workflow?: string;
  model?: string;
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
};

function mergeRecentTools(
  existing: Array<{ tool: string; args: string; endMs: number }> | undefined,
  incoming: Array<{ tool: string; args: string; endMs: number }> | undefined,
): Array<{ tool: string; args: string; endMs: number }> | undefined {
  if (!incoming?.length) return existing;
  return incoming.slice(-8);
}

function appendLine(value: string, line: string): string {
  const next = [value, line.trim()].filter(Boolean).join("\n");
  return next.split(/\r?\n/).slice(-12).join("\n");
}

function compactOutputPreview(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line) => !/^\*\*[^*]+\*\*\s+I\s/i.test(line))
    .filter((line) => !/\bI need to make sure\b/i.test(line))
    .filter((line) => !/\bI want the user to\b/i.test(line));
  return lines.slice(-3);
}

export function createTakomiLiveUpdateBridge(
  tasks: LiveTask[],
  mode: "single" | "parallel" | "chain",
  agentScope: string,
  onUpdate: ToolUpdate | undefined,
) {
  const results: TakomiDispatchResult[] = tasks.map((task, index) => ({
    agent: task.agent,
    task: task.task,
    workflow: task.workflow,
    model: task.model,
    thinking: task.thinking,
    conversationId: task.conversationId ?? `pending-${index + 1}`,
    code: -1,
    output: "Queued.",
    stderr: "",
    preflight: "",
    lastActivityAt: Date.now(),
    recentTools: [],
    recentOutput: ["Queued."],
    toolCount: 0,
  }));

  const emit = () => {
    const done = results.filter((result) => result.code === 0).length;
    const running = results.filter((result) => result.code === -1).length;
    onUpdate?.({
      content: [{ type: "text", text: `Takomi ${mode}: ${done}/${results.length} done, ${running} running` }],
      details: { results: [...results], mode, agentScope },
    });
  };

  return {
    results,
    event(index: number, event: TakomiSubagentRuntimeEvent): void {
      const current = results[index];
      if (!current) return;
      current.lastActivityAt = Date.now();
      if (event.type === "start") {
        current.startedAt = Date.now();
        current.conversationId = event.state.conversationId ?? current.conversationId;
        current.thinking = event.state.thinking ?? current.thinking;
        current.sessionFile = event.state.sessionFile ?? current.sessionFile;
        current.output = event.state.summary ?? "Starting.";
        current.recentOutput = [current.output].filter(Boolean).slice(-8);
      } else if (event.type === "update") {
        current.model = event.patch.model ?? current.model;
        current.thinking = event.patch.thinking ?? current.thinking;
        current.sessionFile = event.patch.sessionFile ?? current.sessionFile;
        current.currentTool = event.patch.currentTool;
        current.currentToolArgs = event.patch.currentToolArgs;
        current.currentToolStartedAt = event.patch.currentToolStartedAt;
        current.recentTools = mergeRecentTools(current.recentTools, event.patch.recentTools);
        current.toolCount = event.patch.toolCount ?? current.toolCount;
        current.output = event.patch.outputText ?? event.patch.summary ?? current.output;
        current.recentOutput = event.patch.recentOutput
          ?? (event.patch.outputText ? compactOutputPreview(event.patch.outputText) : current.recentOutput);
        if (event.patch.logs?.length) current.output = appendLine(current.output, event.patch.logs.join("\n"));
      } else if (event.type === "appendLog") {
        current.output = appendLine(current.output, event.chunk);
        current.recentOutput = [...(current.recentOutput ?? []), event.chunk.trim()].filter(Boolean).slice(-8);
      } else if (event.type === "complete") {
        current.code = 0;
        current.endedAt = Date.now();
        current.currentTool = undefined;
        current.currentToolArgs = undefined;
        current.currentToolStartedAt = undefined;
        current.output = event.patch?.outputText ?? event.patch?.summary ?? current.output;
        current.recentOutput = event.patch?.recentOutput ?? current.recentOutput;
        current.recentTools = mergeRecentTools(current.recentTools, event.patch?.recentTools);
        current.toolCount = event.patch?.toolCount ?? current.toolCount;
        current.sessionFile = event.patch?.sessionFile ?? current.sessionFile;
      } else if (event.type === "block") {
        current.code = 1;
        current.endedAt = Date.now();
        current.currentTool = undefined;
        current.currentToolArgs = undefined;
        current.currentToolStartedAt = undefined;
        current.output = event.patch?.outputText ?? event.patch?.summary ?? current.output;
        current.recentOutput = event.patch?.recentOutput ?? current.recentOutput;
        current.recentTools = mergeRecentTools(current.recentTools, event.patch?.recentTools);
        current.toolCount = event.patch?.toolCount ?? current.toolCount;
        current.sessionFile = event.patch?.sessionFile ?? current.sessionFile;
        if (event.patch?.logs?.length) current.stderr = event.patch.logs.join("\n");
      }
      emit();
    },
    finish(index: number, result: TakomiDispatchResult): void {
      results[index] = result;
      emit();
    },
  };
}

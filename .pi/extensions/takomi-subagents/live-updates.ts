import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import type { TakomiSubagentRuntimeEvent } from "../takomi-runtime/subagent-types";
import type { TakomiDispatchResult } from "./dispatch";

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

function appendLine(value: string, line: string): string {
  const next = [value, line.trim()].filter(Boolean).join("\n");
  return next.split(/\r?\n/).slice(-12).join("\n");
}

export function createTakomiLiveUpdateBridge(
  tasks: LiveTask[],
  mode: "single" | "parallel" | "chain",
  agentScope: string,
  onUpdate: ToolUpdate | undefined,
) {
  const results: TakomiDispatchResult[] = tasks.map((task, index) => ({
    agent: task.agent,
    workflow: task.workflow,
    model: task.model,
    thinking: task.thinking,
    conversationId: task.conversationId ?? `pending-${index + 1}`,
    code: -1,
    output: "Queued.",
    stderr: "",
    preflight: "",
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
      if (event.type === "start") {
        current.conversationId = event.state.conversationId ?? current.conversationId;
        current.thinking = event.state.thinking ?? current.thinking;
        current.output = event.state.summary ?? "Starting.";
      } else if (event.type === "update") {
        current.model = event.patch.model ?? current.model;
        current.thinking = event.patch.thinking ?? current.thinking;
        current.output = event.patch.outputText ?? event.patch.summary ?? current.output;
        if (event.patch.logs?.length) current.output = appendLine(current.output, event.patch.logs.join("\n"));
      } else if (event.type === "appendLog") {
        current.output = appendLine(current.output, event.chunk);
      } else if (event.type === "complete") {
        current.code = 0;
        current.output = event.patch?.outputText ?? event.patch?.summary ?? current.output;
      } else if (event.type === "block") {
        current.code = 1;
        current.output = event.patch?.outputText ?? event.patch?.summary ?? current.output;
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

import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import {
  buildTaskPrompt,
  runModelPreflight,
  runPiAgentJson,
  writeTempPrompt,
  type ChecklistInput,
} from "../takomi-runtime/shared";
import type {
  TakomiSubagentRuntimeEvent,
  TakomiSubagentRunPatch,
} from "../takomi-runtime/subagent-types";
import type { TakomiAgentConfig } from "./agents";
import {
  buildFallbackModels,
  buildSystemPrompt,
  hasThinkingSuffix,
} from "./dispatch-helpers";

export type TakomiDispatchInput = {
  agent: TakomiAgentConfig;
  task: string;
  rootCwd: string;
  cwd?: string;
  workflow?: string;
  skills?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  checklist?: ChecklistInput;
  stage?: string;
  taskLabel?: string;
  parentTaskId?: string;
  parentRunKey?: string;
  boardTaskStatus?: "pending" | "in-progress" | "completed" | "blocked";
  source: "runtime-board" | "takomi-tool";
  rerunInstructions?: string;
};

export type TakomiDispatchResult = {
  agent: string;
  task: string;
  workflow?: string;
  model?: string;
  warning?: string;
  thinking?: TakomiThinkingLevel;
  conversationId: string;
  code: number;
  output: string;
  stderr: string;
  preflight: string;
  startedAt?: number;
  endedAt?: number;
  lastActivityAt?: number;
  currentTool?: string;
  currentToolArgs?: string;
  currentToolStartedAt?: number;
  recentTools?: Array<{ tool: string; args: string; endMs: number }>;
  recentOutput?: string[];
  toolCount?: number;
  sessionFile?: string;
};

export type TakomiDispatchHooks = {
  emit?: (event: TakomiSubagentRuntimeEvent) => void;
  onPatch?: (patch: TakomiSubagentRunPatch, runKey: string) => void | Promise<void>;
};

export async function dispatchTakomiSubagent(
  ctx: ExtensionContext,
  input: TakomiDispatchInput,
  signal?: AbortSignal,
  hooks?: TakomiDispatchHooks,
): Promise<TakomiDispatchResult> {
  const subagentCwd = input.cwd ? path.resolve(input.rootCwd, input.cwd) : input.rootCwd;
  const conversationId = input.conversationId || `${input.agent.name}-${Date.now()}`;
  const runKey = conversationId;
  const sessionDir = path.join(input.rootCwd, ".pi", "takomi", "subagents");
  const sessionPath = path.join(sessionDir, `${conversationId}.jsonl`);
  await mkdir(sessionDir, { recursive: true });
  const startedAt = Date.now();
  let lastActivityAt = startedAt;
  let currentTool: string | undefined;
  let currentToolArgs: string | undefined;
  let currentToolStartedAt: number | undefined;
  let toolCount = 0;
  let recentTools: Array<{ tool: string; args: string; endMs: number }> = [];
  let recentOutput: string[] = [];

  const appendRecentOutput = (text: string) => {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return;
    recentOutput = [...recentOutput, ...lines].slice(-8);
    lastActivityAt = Date.now();
  };

  hooks?.emit?.({
    type: "start",
    runKey,
    state: {
      agent: input.agent.name,
      taskLabel: input.taskLabel ?? input.task.split(/\r?\n/)[0]?.trim() ?? input.agent.name,
      workflow: input.workflow,
      stage: input.stage,
      conversationId,
      parentTaskId: input.parentTaskId,
      parentRunKey: input.parentRunKey,
      checklist: input.checklist,
      boardTaskStatus: input.boardTaskStatus,
      fallbackModels: input.fallbackModels,
      thinking: input.thinking ?? input.agent.thinking,
      summary: "Preparing delegated run.",
      source: input.source,
    },
  });

  const fallbackModels = buildFallbackModels(input);
  const preflight = await runModelPreflight(ctx, subagentCwd, input.model, fallbackModels, signal);
  const thinking = input.thinking ?? input.agent.thinking;

  if (preflight.model) {
    const patch = {
      model: preflight.model,
      fallbackModels,
      thinking,
      boardTaskStatus: input.boardTaskStatus,
      checklist: input.checklist,
      summary: `Model ready: ${preflight.model}${thinking ? ` (${thinking})` : ""}`,
    };
    hooks?.emit?.({ type: "update", runKey, patch });
    await hooks?.onPatch?.(patch, runKey);
  }

  if (!preflight.model) {
    const result = {
      agent: input.agent.name,
      task: input.task,
      workflow: input.workflow,
      model: "",
      warning: preflight.warning,
      thinking,
      conversationId,
      code: 1,
      output: "",
      stderr: preflight.report,
      preflight: preflight.report,
      startedAt,
      endedAt: Date.now(),
      lastActivityAt,
      recentTools,
      recentOutput,
      toolCount,
      sessionFile: sessionPath,
    };
    hooks?.emit?.({
      type: "block",
      runKey,
      patch: {
        summary: `Subagent ${input.agent.name} blocked before launch.`,
        boardTaskStatus: input.boardTaskStatus,
        checklist: input.checklist,
        fallbackModels,
        thinking,
        logs: [preflight.warning || "No model matched the requested run."],
      },
    });
    return result;
  }

  const promptPath = await writeTempPrompt(input.agent.name, buildSystemPrompt(input));
  const taskPrompt = buildTaskPrompt({
    task: input.rerunInstructions?.trim() || input.task,
    workflow: input.workflow,
    skills: input.skills,
    checklist: input.checklist,
    stage: input.stage,
  });
  const args = ["--mode", "json", "--append-system-prompt", promptPath, "--session", sessionPath, taskPrompt];
  args.unshift("--model", preflight.model);
  if (thinking && !hasThinkingSuffix(preflight.model)) args.unshift("--thinking", thinking);
  if (input.agent.tools?.length) args.unshift("--tools", input.agent.tools.join(","));

  const result = await runPiAgentJson(subagentCwd, args, signal, {
    onAssistantText: (text) => {
      appendRecentOutput(text);
      hooks?.emit?.({
        type: "update",
        runKey,
        patch: {
          outputText: text,
          recentOutput,
          currentTool,
          currentToolArgs,
          currentToolStartedAt,
          recentTools,
          toolCount,
          boardTaskStatus: input.boardTaskStatus,
          checklist: input.checklist,
        },
      });
    },
    onEventText: (line) => {
      appendRecentOutput(line);
      hooks?.emit?.({ type: "appendLog", runKey, chunk: line });
      hooks?.emit?.({ type: "update", runKey, patch: { recentOutput, boardTaskStatus: input.boardTaskStatus, checklist: input.checklist } });
    },
    onToolEvent: (event) => {
      lastActivityAt = Date.now();
      if (event.type === "start") {
        currentTool = event.toolName;
        currentToolArgs = event.args;
        currentToolStartedAt = Date.now();
        toolCount += 1;
      } else if (event.type === "end") {
        recentTools = [...recentTools, { tool: event.toolName, args: currentTool === event.toolName ? currentToolArgs ?? "" : "", endMs: Date.now() }].slice(-8);
        if (currentTool === event.toolName) {
          currentTool = undefined;
          currentToolArgs = undefined;
          currentToolStartedAt = undefined;
        }
      }
      hooks?.emit?.({
        type: "update",
        runKey,
        patch: {
          currentTool,
          currentToolArgs,
          currentToolStartedAt,
          recentTools,
          recentOutput,
          toolCount,
          boardTaskStatus: input.boardTaskStatus,
          checklist: input.checklist,
        },
      });
    },
    onStderr: (chunk) => {
      appendRecentOutput(chunk);
      hooks?.emit?.({ type: "appendLog", runKey, chunk });
      hooks?.emit?.({ type: "update", runKey, patch: { recentOutput, boardTaskStatus: input.boardTaskStatus, checklist: input.checklist } });
    },
  });

  const output = result.stdout.trim();
  const dispatchResult: TakomiDispatchResult = {
    agent: input.agent.name,
    task: input.task,
    workflow: input.workflow,
    model: preflight.model,
    warning: preflight.warning,
    thinking,
    conversationId,
    code: result.code,
    output,
    stderr: result.stderr.trim(),
    preflight: preflight.report,
    startedAt,
    endedAt: Date.now(),
    lastActivityAt,
    currentTool,
    currentToolArgs,
    currentToolStartedAt,
    recentTools,
    recentOutput,
    toolCount,
    sessionFile: sessionPath,
  };

  if (result.code !== 0) {
    hooks?.emit?.({
      type: "block",
      runKey,
      patch: {
        model: preflight.model,
        fallbackModels,
        thinking,
        boardTaskStatus: input.boardTaskStatus,
        checklist: input.checklist,
        summary: `Subagent ${input.agent.name} failed.`,
        outputText: output || undefined,
        logs: [result.stderr || result.stdout || "No output"],
      },
    });
    return dispatchResult;
  }

  hooks?.emit?.({
    type: "complete",
    runKey,
    patch: {
      model: preflight.model,
      fallbackModels,
      thinking,
      boardTaskStatus: input.boardTaskStatus,
      checklist: input.checklist,
      summary: output || `Subagent ${input.agent.name} run finished. Checklist-validated task completion is still a board action.`,
      outputText: output || undefined,
    },
  });

  return dispatchResult;
}

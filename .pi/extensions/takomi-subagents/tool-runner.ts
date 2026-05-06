import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import { loadTakomiProfile } from "../takomi-runtime/profile";
import {
  TAKOMI_SUBAGENT_EVENT_CHANNEL,
  type TakomiSubagentRuntimeEvent,
} from "../takomi-runtime/subagent-types";
import { resolveAgentName } from "./agent-aliases";
import { discoverTakomiAgents, type TakomiAgentConfig, type TakomiAgentScope } from "./agents";
import { createTakomiDelegationPlan, renderTakomiDelegationPlan } from "./delegation-plan";
import { dispatchTakomiSubagent, type TakomiDispatchResult } from "./dispatch";
import { createTakomiLiveUpdateBridge } from "./live-updates";

type ChecklistItem = string | { text: string; done?: boolean };

export type TakomiSubagentToolTask = {
  agent: string;
  task: string;
  workflow?: string;
  skills?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  cwd?: string;
  checklist?: ChecklistItem[];
};

export type TakomiSubagentToolParams = Partial<TakomiSubagentToolTask> & {
  tasks?: TakomiSubagentToolTask[];
  chain?: TakomiSubagentToolTask[];
  confirmLaunch?: boolean;
  previewOnly?: boolean;
  agentScope?: TakomiAgentScope;
  confirmProjectAgents?: boolean;
};

type ToolUpdate = (partial: {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}) => void;
const MAX_PARALLEL_TASKS = 8, MAX_CONCURRENCY = 4;

function emitRuntimeSubagentEvent(pi: ExtensionAPI, event: TakomiSubagentRuntimeEvent): void {
  pi.events.emit(TAKOMI_SUBAGENT_EVENT_CHANNEL, event);
}

function resultText(result: TakomiDispatchResult): string {
  return [
    result.preflight,
    result.output || result.stderr || `Subagent ${result.agent} finished without output.`,
  ].filter(Boolean).join("\n\n");
}

function textResult<TDetails extends Record<string, unknown>>(text: string, details: TDetails, isError?: boolean) {
  return { content: [{ type: "text" as const, text }], details, isError };
}

async function mapWithConcurrencyLimit<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
  let nextIndex = 0;
  const workers = new Array(Math.min(Math.max(concurrency, 1), items.length)).fill(undefined).map(async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

function hasProjectAgents(tasks: Array<{ agent: string }>, agents: Map<string, TakomiAgentConfig>): boolean {
  return tasks.some((task) => agents.get(task.agent)?.source === "project");
}
function resolveMode(params: TakomiSubagentToolParams): "single" | "parallel" | "chain" | undefined {
  const hasChain = Boolean(params.chain?.length);
  const hasParallel = Boolean(params.tasks?.length);
  const hasSingle = Boolean(params.agent && params.task);
  if (Number(hasChain) + Number(hasParallel) + Number(hasSingle) !== 1) return undefined;
  return hasChain ? "chain" : hasParallel ? "parallel" : "single";
}
function resolveTasks(params: TakomiSubagentToolParams): TakomiSubagentToolTask[] {
  if (params.chain?.length) return params.chain;
  if (params.tasks?.length) return params.tasks;
  if (params.agent && params.task) {
    return [{
      agent: params.agent,
      task: params.task,
      workflow: params.workflow,
      skills: params.skills,
      model: params.model,
      fallbackModels: params.fallbackModels,
      thinking: params.thinking,
      conversationId: params.conversationId,
      cwd: params.cwd,
      checklist: params.checklist,
    }];
  }
  return [];
}
export async function executeTakomiSubagentTool(
  pi: ExtensionAPI,
  params: TakomiSubagentToolParams,
  signal: AbortSignal | undefined,
  onUpdate: ToolUpdate | undefined,
  ctx: ExtensionContext,
) {
  const rootCwd = params.cwd ? path.resolve(ctx.cwd, params.cwd) : ctx.cwd;
  const profile = await loadTakomiProfile(rootCwd);
  const agentScope = params.agentScope ?? "both";
  const agents = discoverTakomiAgents(rootCwd, agentScope);
  const byName = new Map<string, TakomiAgentConfig>(agents.map((agent) => [agent.name, agent]));
  const mode = resolveMode(params);
  const tasks = resolveTasks(params).map((task) => ({
    ...task,
    agent: resolveAgentName(task.agent, byName),
  }));

  if (!mode) {
    return textResult(
      `Provide exactly one mode: agent/task, tasks, or chain.\nAvailable agents: ${agents.map((agent) => `${agent.name} (${agent.source})`).join(", ") || "none"}`,
      { results: [], availableAgents: agents.map((agent) => agent.name), agentScope },
      true,
    );
  }
  if (mode === "parallel" && tasks.length > MAX_PARALLEL_TASKS) {
    return textResult(`Too many parallel tasks (${tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`, { results: [], agentScope }, true);
  }
  if (params.confirmProjectAgents !== false && ctx.hasUI && hasProjectAgents(tasks, byName)) {
    const names = tasks.map((task) => byName.get(task.agent)).filter((agent): agent is TakomiAgentConfig => agent?.source === "project").map((agent) => agent.name);
    const ok = await ctx.ui.confirm("Run project-local Takomi agents?", `Agents: ${[...new Set(names)].join(", ")}\n\nProject agents are repo-controlled. Continue only for trusted repositories.`);
    if (!ok) return textResult("Canceled: project-local agents not approved.", { results: [], agentScope, mode });
  }
  const plan = createTakomiDelegationPlan({
    source: "takomi-tool",
    launchMode: profile.launchMode ?? "auto",
    profile,
    tasks: tasks.map((task, index) => ({
      id: task.conversationId ?? `direct-${index + 1}`,
      title: task.task,
      agent: task.agent,
      task: task.task,
      workflow: task.workflow,
      model: task.model,
      fallbackModels: task.fallbackModels,
      thinking: task.thinking,
      conversationId: task.conversationId,
      checklist: task.checklist,
      dispatchPolicy: "subagent",
    })),
  });
  if (params.previewOnly || (plan.launchMode === "manual" && !params.confirmLaunch)) {
    return textResult(renderTakomiDelegationPlan(plan), { plan, availableAgents: agents.map((agent) => agent.name), agentScope, mode });
  }
  const live = createTakomiLiveUpdateBridge(tasks, mode, agentScope, onUpdate);
  const runOne = async (item: TakomiSubagentToolTask, index: number, previousOutput = "") => {
    const config = byName.get(item.agent);
    if (!config) throw new Error(`Unknown subagent '${item.agent}'. Available: ${agents.map((agent) => `${agent.name} (${agent.source})`).join(", ") || "none"}`);
    const result = await dispatchTakomiSubagent(ctx, {
      agent: config,
      task: item.task.replaceAll("{previous}", previousOutput),
      rootCwd,
      cwd: item.cwd,
      workflow: item.workflow,
      skills: item.skills,
      model: item.model,
      fallbackModels: item.fallbackModels,
      thinking: item.thinking,
      conversationId: item.conversationId,
      checklist: item.checklist,
      source: "takomi-tool",
    }, signal, {
      emit: (event) => {
        emitRuntimeSubagentEvent(pi, event);
        live.event(index, event);
      },
    });
    live.finish(index, result);
    return result;
  };
  const results: TakomiDispatchResult[] = [];
  try {
    if (mode === "chain") {
      let previousOutput = "";
      for (const [index, item] of tasks.entries()) {
        const result = await runOne(item, index, previousOutput);
        previousOutput = result.output;
        results.push(result);
        if (result.code !== 0) return textResult(resultText(result), { results, mode, agentScope }, true);
      }
    } else if (mode === "parallel") {
      results.push(...await mapWithConcurrencyLimit(tasks, MAX_CONCURRENCY, async (item, index) => {
        return runOne(item, index);
      }));
    } else {
      results.push(await runOne(tasks[0], 0));
    }
  } catch (error) {
    return textResult(error instanceof Error ? error.message : String(error), { results, mode, agentScope }, true);
  }

  const failed = results.find((result) => result.code !== 0);
  return textResult(results.map(resultText).join("\n\n---\n\n"), { results, mode, agentScope }, Boolean(failed) || undefined);
}

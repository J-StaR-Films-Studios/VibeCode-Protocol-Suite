import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import { loadTakomiProfile } from "../takomi-runtime/profile";
import { applyTakomiRoutingDefaults, loadTakomiModelRoutingSnapshot } from "../takomi-runtime/model-routing-defaults";
import { resolveAgentName } from "./agent-aliases";
import { discoverTakomiAgents, type TakomiAgentConfig, type TakomiAgentScope } from "./agents";
import { createTakomiDelegationPlan, renderTakomiDelegationPlan } from "./delegation-plan";
import { createTakomiPiSubagentsEngine } from "./pi-subagents-engine";

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
  overrideUserBlock?: boolean;
};

type ToolUpdate = (partial: {
  content: Array<{ type: "text"; text: string }>;
  details: Record<string, unknown>;
}) => void;
const MAX_PARALLEL_TASKS = 8;
const HARD_STOP_TTL_MS = 10 * 60 * 1000;
const ENGINES = new WeakMap<ExtensionAPI, ReturnType<typeof createTakomiPiSubagentsEngine>>();

type HardStopRecord = {
  at: number;
  reason: string;
  message: string;
};

const RECENT_HARD_STOPS = new WeakMap<ExtensionAPI, Map<string, HardStopRecord>>();

function getEngine(pi: ExtensionAPI): ReturnType<typeof createTakomiPiSubagentsEngine> {
  const existing = ENGINES.get(pi);
  if (existing) return existing;
  const engine = createTakomiPiSubagentsEngine(pi);
  ENGINES.set(pi, engine);
  return engine;
}

function textResult<TDetails extends Record<string, unknown>>(text: string, details: TDetails, isError?: boolean) {
  return { content: [{ type: "text" as const, text }], details, isError };
}

function hasProjectAgents(tasks: Array<{ agent: string }>, agents: Map<string, TakomiAgentConfig>): boolean {
  return tasks.some((task) => agents.get(task.agent)?.source === "project");
}

function hardStopStore(pi: ExtensionAPI): Map<string, HardStopRecord> {
  const existing = RECENT_HARD_STOPS.get(pi);
  if (existing) return existing;
  const next = new Map<string, HardStopRecord>();
  RECENT_HARD_STOPS.set(pi, next);
  return next;
}

function compactTaskForFingerprint(task: TakomiSubagentToolTask): Record<string, unknown> {
  return {
    agent: task.agent,
    task: task.task,
    workflow: task.workflow,
    skills: task.skills,
    model: task.model,
    fallbackModels: task.fallbackModels,
    thinking: task.thinking,
    conversationId: task.conversationId,
    cwd: task.cwd,
  };
}

function createRunFingerprint(rootCwd: string, mode: "single" | "parallel" | "chain" | undefined, tasks: TakomiSubagentToolTask[]): string {
  return JSON.stringify({ rootCwd, mode, tasks: tasks.map(compactTaskForFingerprint) });
}

function hardStopResult(message: string, details: Record<string, unknown>) {
  return textResult([
    message,
    "",
    "HARD STOP: Do not retry this subagent call automatically. Wait for the user's next prompt or explicit approval before launching it again.",
  ].join("\n"), { ...details, takomiHardStop: true }, true);
}

function rememberHardStop(pi: ExtensionAPI, fingerprint: string, reason: string, message: string): void {
  hardStopStore(pi).set(fingerprint, { at: Date.now(), reason, message });
}

function consumeExpiredHardStop(pi: ExtensionAPI, fingerprint: string): HardStopRecord | undefined {
  const store = hardStopStore(pi);
  const record = store.get(fingerprint);
  if (!record) return undefined;
  if (Date.now() - record.at > HARD_STOP_TTL_MS) {
    store.delete(fingerprint);
    return undefined;
  }
  return record;
}

function getTextContent(result: any): string {
  return (result?.content ?? [])
    .map((item: any) => item?.type === "text" && typeof item.text === "string" ? item.text : "")
    .filter(Boolean)
    .join("\n");
}

function detectNativeHardStop(result: any): { reason: string; message: string } | undefined {
  const text = getTextContent(result);
  const details = result?.details;
  const results = Array.isArray(details?.results) ? details.results : [];

  if (/\b(paused after interrupt|waiting for explicit next action|chain cancelled|chain canceled|run cancelled|run canceled|subagent call blocked|resume blocked|blocked by user)\b/i.test(text)) {
    return { reason: "native-pause-cancel-or-block", message: text || "Subagent run paused/cancelled/blocked." };
  }

  if (results.some((child: any) => child?.interrupted === true)) {
    return { reason: "native-interrupt", message: text || "Subagent run paused after interrupt." };
  }

  if (details?.workflowGraph && JSON.stringify(details.workflowGraph).includes('"paused"')) {
    return { reason: "native-workflow-paused", message: text || "Subagent workflow paused." };
  }

  return undefined;
}

function withNativeHardStop(result: any, hardStop: { reason: string; message: string }, takomi: Record<string, unknown>) {
  return {
    ...result,
    content: [{
      type: "text" as const,
      text: [
        hardStop.message,
        "",
        "HARD STOP: The subagent was blocked, cancelled, or paused. Do not retry automatically. Wait for the user's next prompt or explicit approval.",
      ].join("\n"),
    }],
    isError: true,
    details: {
      ...(result?.details ?? {}),
      takomi: {
        ...takomi,
        hardStop: true,
        hardStopReason: hardStop.reason,
      },
    },
  };
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
  const engine = getEngine(pi);
  const rootCwd = params.cwd ? path.resolve(ctx.cwd, params.cwd) : ctx.cwd;
  const profile = await loadTakomiProfile(rootCwd);
  const agentScope = params.agentScope ?? "both";
  const agents = discoverTakomiAgents(rootCwd, agentScope);
  const byName = new Map<string, TakomiAgentConfig>(agents.map((agent) => [agent.name, agent]));
  const mode = resolveMode(params);
  const routingSnapshot = await loadTakomiModelRoutingSnapshot(rootCwd);
  const tasks = resolveTasks(params).map((task) => applyTakomiRoutingDefaults({
    ...task,
    agent: resolveAgentName(task.agent, byName),
  }, routingSnapshot));

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

  const fingerprint = createRunFingerprint(rootCwd, mode, tasks);
  const recentHardStop = consumeExpiredHardStop(pi, fingerprint);
  if (recentHardStop && !params.overrideUserBlock) {
    return hardStopResult(
      `Subagent launch blocked: the same request was already stopped (${recentHardStop.reason}).\n${recentHardStop.message}`,
      { results: [], availableAgents: agents.map((agent) => agent.name), agentScope, mode, blockedAt: recentHardStop.at, reason: recentHardStop.reason },
    );
  }
  if (params.overrideUserBlock) {
    hardStopStore(pi).delete(fingerprint);
  }

  if (params.confirmProjectAgents !== false && ctx.hasUI && hasProjectAgents(tasks, byName)) {
    const names = tasks.map((task) => byName.get(task.agent)).filter((agent): agent is TakomiAgentConfig => agent?.source === "project").map((agent) => agent.name);
    const ok = await ctx.ui.confirm("Run project-local Takomi agents?", `Agents: ${[...new Set(names)].join(", ")}\n\nProject agents are repo-controlled. Continue only for trusted repositories.`);
    if (!ok) {
      const message = "Canceled: project-local agents not approved.";
      rememberHardStop(pi, fingerprint, "project-agent-denied", message);
      return hardStopResult(message, { results: [], agentScope, mode });
    }
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
  if (params.previewOnly) {
    return textResult(renderTakomiDelegationPlan(plan), { plan, availableAgents: agents.map((agent) => agent.name), agentScope, mode });
  }
  if (plan.launchMode === "manual" && !params.confirmLaunch) {
    const message = `${renderTakomiDelegationPlan(plan)}\n\nReview gate is awaiting explicit user approval.`;
    rememberHardStop(pi, fingerprint, "review-gate", "Review gate displayed a delegation plan and paused before launch.");
    return hardStopResult(message, { plan, availableAgents: agents.map((agent) => agent.name), agentScope, mode });
  }
  try {
    const nativeParams: TakomiSubagentToolParams = mode === "single"
      ? { ...params, agent: tasks[0]!.agent, task: tasks[0]!.task, agentScope }
      : mode === "parallel"
        ? { ...params, tasks, agentScope }
        : { ...params, chain: tasks, agentScope };

    const nativeResult: any = await engine.execute(
      "takomi-tool",
      nativeParams,
      signal,
      onUpdate as any,
      ctx,
    );

    const takomi = {
      plan,
      agentScope,
      workflow: params.workflow,
    };
    const nativeHardStop = detectNativeHardStop(nativeResult);
    if (nativeHardStop) {
      rememberHardStop(pi, fingerprint, nativeHardStop.reason, nativeHardStop.message);
      return withNativeHardStop(nativeResult, nativeHardStop, takomi);
    }

    return {
      ...nativeResult,
      details: {
        ...(nativeResult?.details ?? {}),
        takomi,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b(aborted|abort|cancelled|canceled|interrupted)\b/i.test(message)) {
      rememberHardStop(pi, fingerprint, "execution-cancelled", message);
      return hardStopResult(message, { results: [], mode, agentScope });
    }
    return textResult(message, { results: [], mode, agentScope }, true);
  }
}

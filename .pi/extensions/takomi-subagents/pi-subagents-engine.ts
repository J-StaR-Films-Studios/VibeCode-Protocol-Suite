import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  loadPiSubagentsInternals,
  type AgentConfig,
  type AgentScope,
  type Details,
  type SubagentParamsLike,
  type SubagentState,
} from "./pi-subagents-internal";
import { resolveAgentName } from "./agent-aliases";
import { applyTakomiRoutingDefaults, loadTakomiModelRoutingSnapshotSync } from "../takomi-runtime/model-routing-defaults";
import type { TakomiSubagentToolParams, TakomiSubagentToolTask } from "./tool-runner";

type ToolUpdate = (partial: AgentToolResult<Details>) => void;

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"] as const;
const NEVER_ABORT: AbortSignal = new AbortController().signal;

function getSubagentSessionRoot(parentSessionFile: string | null): string {
  if (parentSessionFile) {
    const baseName = path.basename(parentSessionFile, ".jsonl");
    return path.join(path.dirname(parentSessionFile), baseName);
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), "takomi-subagent-session-"));
}

function expandTilde(value: string): string {
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function createState(): SubagentState {
  return {
    baseCwd: process.cwd(),
    currentSessionId: null,
    asyncJobs: new Map(),
    foregroundRuns: new Map(),
    foregroundControls: new Map(),
    lastForegroundControlId: null,
    pendingForegroundControlNotices: new Map(),
    cleanupTimers: new Map(),
    lastUiContext: null,
    poller: null,
    completionSeen: new Map(),
    watcher: null,
    watcherRestartTimer: null,
    resultFileCoalescer: {
      schedule: () => false,
      clear: () => {},
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

function normalizeThinking(value: unknown): string | undefined {
  return typeof value === "string" && (THINKING_LEVELS as readonly string[]).includes(value) ? value : undefined;
}

function buildTakomiTaskPrompt(task: TakomiSubagentToolTask): string {
  const checklist = task.checklist?.length
    ? [
        "Checklist:",
        ...task.checklist.map((item) => typeof item === "string" ? `- [ ] ${item}` : `- [${item.done ? "x" : " "}] ${item.text}`),
      ].join("\n")
    : "";
  const takomiContext = [
    task.workflow ? `Takomi workflow: ${task.workflow}` : "",
    task.skills?.length ? `Takomi skills/context overlays: ${task.skills.join(", ")}` : "",
    checklist,
  ].filter(Boolean).join("\n\n");

  return takomiContext ? `${takomiContext}\n\n${task.task}` : task.task;
}

function modelWithThinking(model: string | undefined, thinking: string | undefined): string | undefined {
  const level = normalizeThinking(thinking);
  if (!model || !level || level === "off") return model;
  if (new RegExp(`:(${THINKING_LEVELS.join("|")})$`, "i").test(model)) return model;
  return `${model}:${level}`;
}

function safeConversationSlug(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "conversation";
}

function stableConversationSessionDir(rootCwd: string, tasks: TakomiSubagentToolTask[]): string | undefined {
  const ids = tasks.map((task) => task.conversationId).filter((id): id is string => Boolean(id));
  if (!ids.length) return undefined;
  return path.join(rootCwd, ".pi", "takomi", "subagent-conversations", safeConversationSlug(ids.join("__")));
}

function defaultChildExtensions(): string[] {
  // Child runs must not auto-load every user/project extension because this repo
  // currently has both global and project Takomi extensions, which causes tool
  // name conflicts in children. But model providers such as oauth-router are
  // extensions too, so we explicitly allow the provider extension through.
  const roots = [
    process.env.PI_AGENT_ROOT,
    path.join(os.homedir(), ".pi", "agent"),
    path.join(process.cwd(), ".pi"),
  ].filter((root): root is string => Boolean(root));
  const candidates = roots.flatMap((root) => [
    path.join(root, "extensions", "oauth-router", "index.ts"),
    path.join(root, "extensions", "oauth-router", "index.js"),
  ]);
  return candidates.filter((candidate) => fs.existsSync(candidate));
}

function withTakomiAgentDefaults(agent: AgentConfig, cwd: string): AgentConfig {
  const routed = applyTakomiRoutingDefaults({
    agent: agent.name,
    model: agent.model,
    fallbackModels: agent.fallbackModels,
    thinking: agent.thinking,
  }, loadTakomiModelRoutingSnapshotSync(cwd));
  return {
    ...agent,
    model: routed.model,
    fallbackModels: routed.fallbackModels,
    thinking: routed.thinking,
    systemPromptMode: agent.systemPromptMode ?? "replace",
    inheritProjectContext: agent.inheritProjectContext ?? true,
    inheritSkills: agent.inheritSkills ?? false,
    defaultContext: agent.defaultContext ?? "fresh",
    extensions: [...new Set([...(agent.extensions ?? []), ...defaultChildExtensions()])],
  };
}

function discoverUnifiedAgents(discoverPiAgents: any, cwd: string, scope: AgentScope): { agents: AgentConfig[] } {
  return { agents: discoverPiAgents(cwd, scope).agents.map((agent: AgentConfig) => withTakomiAgentDefaults(agent, cwd)) };
}

function agentNameSet(discoverPiAgents: any, cwd: string): Set<string> {
  return new Set(discoverUnifiedAgents(discoverPiAgents, cwd, "both").agents.map((agent) => agent.name));
}

function mapSingleTask(task: TakomiSubagentToolTask, names: Set<string>) {
  const resolvedAgent = resolveAgentName(task.agent, new Map([...names].map((name) => [name, { name } as any])));
  return {
    agent: resolvedAgent,
    task: buildTakomiTaskPrompt({ ...task, agent: resolvedAgent }),
    cwd: task.cwd,
    model: modelWithThinking(task.model, task.thinking),
    skill: task.skills?.length ? task.skills : undefined,
  };
}

function toSubagentParams(params: TakomiSubagentToolParams, rootCwd: string, discoverPiAgents: any): SubagentParamsLike {
  const mode = resolveMode(params);
  const tasks = resolveTasks(params);
  const names = agentNameSet(discoverPiAgents, rootCwd);
  if (!mode) throw new Error("Provide exactly one mode: agent/task, tasks, or chain.");

  const base = {
    agentScope: params.agentScope ?? "both",
    cwd: rootCwd,
    context: "fresh" as const,
    async: false,
    clarify: false,
    includeProgress: true,
    sessionDir: stableConversationSessionDir(rootCwd, tasks),
  };

  if (mode === "single") {
    const task = tasks[0]!;
    const mapped = mapSingleTask(task, names);
    return {
      ...base,
      agent: mapped.agent,
      task: mapped.task,
      cwd: task.cwd ? path.resolve(rootCwd, task.cwd) : rootCwd,
      model: mapped.model,
      skill: mapped.skill,
    };
  }

  if (mode === "parallel") {
    return {
      ...base,
      tasks: tasks.map((task) => mapSingleTask(task, names)),
    };
  }

  return {
    ...base,
    chain: tasks.map((task) => {
      const mapped = mapSingleTask(task, names);
      return {
        agent: mapped.agent,
        task: mapped.task,
        cwd: task.cwd,
        model: mapped.model,
        skill: mapped.skill,
      };
    }),
  };
}

export function createTakomiPiSubagentsEngine(pi: ExtensionAPI) {
  const state = createState();
  let executorPromise: Promise<any> | null = null;

  async function getExecutor() {
    if (!executorPromise) {
      executorPromise = loadPiSubagentsInternals().then((internals) => {
        const config = {
          maxSubagentDepth: 2,
          asyncByDefault: false,
          forceTopLevelAsync: false,
        };
        return {
          executor: internals.createSubagentExecutor({
            pi,
            state,
            config,
            asyncByDefault: false,
            tempArtifactsDir: internals.TEMP_ARTIFACTS_DIR,
            getSubagentSessionRoot,
            expandTilde,
            discoverAgents: (cwd: string, scope: AgentScope) => discoverUnifiedAgents(internals.discoverPiAgents, cwd, scope),
          }),
          discoverPiAgents: internals.discoverPiAgents,
        };
      });
    }
    return executorPromise;
  }

  return {
    async execute(
      id: string,
      params: TakomiSubagentToolParams,
      signal: AbortSignal | undefined,
      onUpdate: ToolUpdate | undefined,
      ctx: ExtensionContext,
    ): Promise<AgentToolResult<Details>> {
      const rootCwd = params.cwd ? path.resolve(ctx.cwd, params.cwd) : ctx.cwd;
      const { executor, discoverPiAgents } = await getExecutor();
      const subagentParams = toSubagentParams(params, rootCwd, discoverPiAgents);
      return executor.execute(id, subagentParams, signal ?? NEVER_ABORT, onUpdate, ctx);
    },
  };
}

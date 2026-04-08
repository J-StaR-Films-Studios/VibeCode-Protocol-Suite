import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import {
  buildSessionState,
  createSessionId,
  createTask,
  decideRoute,
  getSessionPaths,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  renderMasterPlan,
  renderTaskFile,
  serializeSessionState,
  slugifyTaskTitle,
  type OrchestratorTask,
  type OrchestratorTaskStatus,
  type TakomiRole,
  type TakomiWorkflowId,
  type VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import { discoverProjectAgents, type TakomiAgentConfig } from "../takomi-subagents/agents";

type TakomiState = {
  enabled: boolean;
  autoOrch: boolean;
  planMode: boolean;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  activeSessionId?: string;
};

const DEFAULT_STATE: TakomiState = {
  enabled: true,
  autoOrch: false,
  planMode: false,
  role: "general",
};

const STATE_ENTRY = "takomi-runtime-state";

function cloneState(state: TakomiState): TakomiState {
  return { ...state };
}

function formatState(state: TakomiState): string {
  return [
    `Takomi ${state.enabled ? "on" : "off"}`,
    `role=${state.role}`,
    `stage=${state.stage ?? "-"}`,
    `workflow=${state.workflow ?? "-"}`,
    `autoOrch=${state.autoOrch ? "on" : "off"}`,
    `plan=${state.planMode ? "on" : "off"}`,
    state.activeSessionId ? `session=${state.activeSessionId}` : "",
  ].filter(Boolean).join(" | ");
}

function setStageAndWorkflow(state: TakomiState, stage: VibeLifecycleStage) {
  state.stage = stage;
  state.workflow = stage === "genesis" ? "vibe-genesis" : stage === "design" ? "vibe-design" : "vibe-build";
  state.role = stage === "design" ? "design" : stage === "build" ? "orchestrator" : "architect";
  state.enabled = true;
}

function rolePrompt(role: TakomiRole): string {
  switch (role) {
    case "orchestrator":
      return [
        "You are operating in Takomi orchestrator mode.",
        "Break work into tasks, delegate with specialist agents, review outputs, and route revisions intelligently.",
        "When a task needs more work, you may send it back to the same agent using the same conversation continuity if that is most efficient.",
      ].join("\n");
    case "architect":
      return [
        "You are operating in Takomi architect mode.",
        "Clarify scope, define acceptance criteria, and build the project foundation before design or implementation.",
      ].join("\n");
    case "design":
      return [
        "You are operating in Takomi design mode.",
        "Translate genesis context into build-ready UX and visual direction.",
        "Prefer Gemini or a similarly strong design-oriented model if available.",
      ].join("\n");
    case "code":
      return [
        "You are operating in Takomi code mode.",
        "Implement directly, keep scope controlled, and verify after changes.",
      ].join("\n");
    case "review":
      return [
        "You are operating in Takomi review mode.",
        "Focus on correctness, risk, omissions, and actionable review feedback.",
      ].join("\n");
    default:
      return [
        "You are operating in Takomi general mode.",
        "Choose the correct lifecycle stage and specialist behavior based on the request.",
      ].join("\n");
  }
}

function planPrompt(): string {
  return [
    "Takomi planning mode is active.",
    "Before major implementation, produce a short numbered plan.",
    "If the request is broad, explicitly identify whether the user is in genesis, design, or build.",
  ].join("\n");
}

function getInjectedPlaybook(state: TakomiState): string | undefined {
  if (!state.workflow) return undefined;
  const workflow = getWorkflowDefinition(state.workflow);
  return [
    `${workflow.title} is the active Takomi workflow.`,
    workflow.purpose,
    workflow.preferredModelHint ?? "",
    workflow.playbook,
    workflow.nextStage ? `After this stage, recommend ${workflow.nextStage}.` : "",
  ].filter(Boolean).join("\n\n");
}

function shouldAutoRoute(text: string): boolean {
  const lowered = text.toLowerCase();
  const broadSignal = ["use takomi", "orchestrate", "plan and build", "full workflow", "break this down", "coordinate"].some((signal) => lowered.includes(signal));
  const multiClause = (lowered.match(/\b(and|then|also|after|while)\b/g) ?? []).length >= 2;
  return broadSignal || (lowered.length > 220 && multiClause);
}

function buildTaskRows(tasks: OrchestratorTask[]): string {
  return tasks.map((task) => `${task.id}: ${task.title} [${task.status}] -> ${task.preferredAgent ?? task.role}${task.conversationId ? ` (${task.conversationId})` : ""}${task.workflow ? ` | workflow=${task.workflow}` : ""}${task.preferredModel ? ` | model=${task.preferredModel}` : ""}${task.skills?.length ? ` | skills=${task.skills.join(",")}` : ""}`).join("\n");
}

function resolveTaskAgent(task: OrchestratorTask): string {
  return task.preferredAgent ?? (task.role === "code" ? "coder" : task.role === "design" ? "designer" : task.role === "architect" ? "architect" : task.role === "review" ? "reviewer" : "orchestrator");
}

function appendTaskNote(existing: string | undefined, heading: string, body?: string): string {
  if (!body?.trim()) return existing ?? "";
  return [existing, "", `${heading}:`, body.trim()].filter(Boolean).join("\n").trim();
}

function applyChecklistUpdates(
  current: OrchestratorTask["checklist"],
  updates?: Array<{ text?: string; index?: number; done?: boolean }>,
): OrchestratorTask["checklist"] {
  if (!current?.length || !updates?.length) return current;
  const next = current.map((item: NonNullable<OrchestratorTask["checklist"]>[number]) => ({ ...item }));
  for (const update of updates) {
    const idx = typeof update.index === "number"
      ? update.index
      : typeof update.text === "string"
        ? next.findIndex((item: NonNullable<OrchestratorTask["checklist"]>[number]) => item.text === update.text)
        : -1;
    if (idx >= 0 && next[idx]) next[idx] = { ...next[idx], done: update.done ?? next[idx].done };
  }
  return next;
}

function getTaskFolder(paths: ReturnType<typeof getSessionPaths>, status: OrchestratorTask["status"]) {
  switch (status) {
    case "in-progress":
      return paths.inProgress;
    case "completed":
      return paths.completed;
    case "blocked":
      return paths.blocked;
    case "pending":
    default:
      return paths.pending;
  }
}

function getTaskFileName(task: OrchestratorTask): string {
  return `${task.id}_${slugifyTaskTitle(task.title)}.task.md`;
}

function formatChecklist(checklist?: Array<string | { text: string; done?: boolean }>): string {
  if (!checklist?.length) return "";
  return [
    "Checklist:",
    ...checklist.map((item) => typeof item === "string" ? `- [ ] ${item}` : `- [${item.done ? "x" : " "}] ${item.text}`),
  ].join("\n");
}

function buildSubagentTaskPrompt(task: OrchestratorTask, extraInstructions?: string): string {
  return [
    task.workflow ? `Workflow: ${task.workflow}` : "",
    task.skills?.length ? `Skills: ${task.skills.join(", ")}` : "",
    formatChecklist(task.checklist),
    "Task:",
    extraInstructions?.trim() || task.notes || task.title,
  ].filter(Boolean).join("\n\n");
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript) return { command: process.execPath, args: [currentScript, ...args] };
  return { command: "pi", args };
}

async function writeTempPrompt(agentName: string, prompt: string) {
  const tmpDir = path.join(os.tmpdir(), `takomi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${agentName}.md`);
  await writeFile(filePath, prompt, "utf8");
  return filePath;
}

async function runPiAgent(cwd: string, args: string[], signal?: AbortSignal): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    proc.on("error", () => resolve({ stdout, stderr, code: 1 }));
    if (signal) {
      const abort = () => proc.kill("SIGTERM");
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
  });
}

async function getAvailableModelKeys(ctx: ExtensionContext): Promise<string[]> {
  try {
    const available = await Promise.resolve(ctx.modelRegistry.getAvailable());
    return available.flatMap((model) => [`${model.provider}/${model.id}`, model.id]);
  } catch {
    return [];
  }
}

async function resolvePreferredModel(ctx: ExtensionContext, requested?: string, fallback?: string): Promise<{ model?: string; warning?: string }> {
  const candidates = [requested, fallback].filter(Boolean) as string[];
  if (candidates.length === 0) return {};
  const keys = await getAvailableModelKeys(ctx);
  const exact = candidates.find((candidate) => keys.includes(candidate));
  if (exact) return { model: exact };

  const loweredKeys = keys.map((key) => key.toLowerCase());
  for (const candidate of candidates) {
    const idx = loweredKeys.findIndex((key) => key === candidate.toLowerCase());
    if (idx >= 0) return { model: keys[idx] };
  }

  for (const candidate of candidates) {
    const idx = loweredKeys.findIndex((key) => key.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(key));
    if (idx >= 0) {
      return {
        model: keys[idx],
        warning: `Requested model '${candidate}' was unavailable; using '${keys[idx]}' instead.`,
      };
    }
  }

  const firstAvailable = keys.find((key) => key.includes("/"));
  if (firstAvailable) {
    return {
      model: firstAvailable,
      warning: `Requested models '${candidates.join("', '")}' were unavailable; using '${firstAvailable}' instead.`,
    };
  }

  return { warning: `No available signed-in model matched '${candidates.join("', '")}'.` };
}

async function loadSessionState(cwd: string, sessionId: string): Promise<{ title: string; tasks: OrchestratorTask[]; paths: ReturnType<typeof getSessionPaths> }> {
  const paths = getSessionPaths(cwd, sessionId);
  const raw = await readFile(paths.stateFile, "utf8");
  const parsed = JSON.parse(raw) as { title: string; tasks: OrchestratorTask[] };
  return { title: parsed.title, tasks: parsed.tasks ?? [], paths };
}

async function syncTaskArtifacts(cwd: string, sessionId: string, title: string, tasks: OrchestratorTask[]) {
  const paths = getSessionPaths(cwd, sessionId);
  await mkdir(paths.pending, { recursive: true });
  await mkdir(paths.inProgress, { recursive: true });
  await mkdir(paths.completed, { recursive: true });
  await mkdir(paths.blocked, { recursive: true });
  await mkdir(paths.stateDir, { recursive: true });
  await writeFile(paths.masterPlan, renderMasterPlan(sessionId, title, tasks), "utf8");
  await writeFile(paths.summary, [
    `# Orchestrator Summary: ${title}`,
    "",
    `- Session ID: ${sessionId}`,
    `- Human docs: ${paths.root}`,
    `- Machine state: ${paths.stateFile}`,
    `- Runtime mode: hybrid`,
  ].join("\n"), "utf8");
  await writeFile(paths.stateFile, serializeSessionState(buildSessionState(sessionId, title, tasks)), "utf8");

  for (const folder of [paths.pending, paths.inProgress, paths.completed, paths.blocked]) {
    const entries = await readdir(folder).catch(() => [] as string[]);
    for (const entry of entries) {
      if (entry.endsWith(".task.md")) {
        await rm(path.join(folder, entry), { force: true });
      }
    }
  }

  for (const task of tasks) {
    const filePath = path.join(getTaskFolder(paths, task.status), getTaskFileName(task));
    await writeFile(filePath, renderTaskFile(task, `Parent session: ${sessionId}\n\nTask title: ${task.title}`), "utf8");
  }

  return paths;
}

async function writeOrchestratorSession(cwd: string, sessionId: string, title: string, tasks: OrchestratorTask[]) {
  return syncTaskArtifacts(cwd, sessionId, title, tasks);
}

async function refreshUi(ctx: ExtensionContext, state: TakomiState) {
  if (!ctx.hasUI) return;
  ctx.ui.setStatus("takomi-runtime", ctx.ui.theme.fg("accent", `⚙ ${state.stage ?? state.role}${state.autoOrch ? " • auto" : ""}${state.planMode ? " • plan" : ""}`));
  ctx.ui.setWidget("takomi-runtime", [
    ctx.ui.theme.fg("muted", "Takomi Runtime"),
    `enabled: ${state.enabled ? "yes" : "no"}`,
    `role: ${state.role}`,
    `stage: ${state.stage ?? "-"}`,
    `workflow: ${state.workflow ?? "-"}`,
    `auto-orch: ${state.autoOrch ? "on" : "off"}`,
    `plan: ${state.planMode ? "on" : "off"}`,
    `session: ${state.activeSessionId ?? "-"}`,
  ]);
}

export default function takomiRuntime(pi: ExtensionAPI) {
  let state = cloneState(DEFAULT_STATE);

  function persistState() {
    pi.appendEntry(STATE_ENTRY, state);
  }

  async function updateState(ctx: ExtensionContext, mutator: () => void, message?: string | (() => string)) {
    mutator();
    persistState();
    await refreshUi(ctx, state);
    const resolvedMessage = typeof message === "function" ? message() : message;
    if (resolvedMessage) ctx.ui.notify(resolvedMessage, "info");
  }

  pi.registerCommand("takomi", {
    description: "Enable Takomi runtime guidance for this session",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
      }, formatState(state));
    },
  });

  pi.registerCommand("orch", {
    description: "Bias the session toward Takomi orchestrator behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "orchestrator";
        state.stage = "build";
        state.workflow = "vibe-build";
      }, "Takomi role set to orchestrator");
    },
  });

  pi.registerCommand("architect", {
    description: "Bias the session toward Takomi architect behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "architect";
      }, "Takomi role set to architect");
    },
  });

  pi.registerCommand("code", {
    description: "Bias the session toward Takomi code behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "code";
      }, "Takomi role set to code");
    },
  });

  pi.registerCommand("review", {
    description: "Bias the session toward Takomi review behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "review";
      }, "Takomi role set to review");
    },
  });

  pi.registerCommand("takomi-genesis", {
    description: "Activate the Takomi genesis stage",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => setStageAndWorkflow(state, "genesis"), "Takomi stage set to Vibe Genesis");
    },
  });

  pi.registerCommand("takomi-design", {
    description: "Activate the Takomi design stage",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => setStageAndWorkflow(state, "design"), "Takomi stage set to Vibe Design");
    },
  });

  pi.registerCommand("takomi-build", {
    description: "Activate the Takomi build stage",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => setStageAndWorkflow(state, "build"), "Takomi stage set to Vibe Build");
    },
  });

  pi.registerCommand("takomi-lifecycle", {
    description: "Show the embedded Takomi lifecycle playbooks",
    handler: async (_args, ctx) => {
      const lines = listWorkflowDefinitions().map((workflow) => `${workflow.id} — ${workflow.purpose}${workflow.preferredModelHint ? ` (${workflow.preferredModelHint})` : ""}`);
      ctx.ui.notify(lines.join("\n\n"), "info");
    },
  });

  pi.registerCommand("takomi-kickoff", {
    description: "Create a default Genesis → Design → Build orchestrator session",
    handler: async (args, ctx) => {
      const title = args.trim() || "Takomi Project";
      const sessionId = createSessionId();
      const tasks = [
        createTask("01", "Genesis foundation", "architect", {
          workflow: "vibe-genesis",
          preferredAgent: "architect",
          checklist: [{ text: "Clarify scope" }, { text: "Lock acceptance criteria" }, { text: "Define boundaries" }],
        }),
        createTask("02", "Design handoff", "design", {
          workflow: "vibe-design",
          preferredAgent: "designer",
          preferredModelHint: "Prefer Gemini or another design-capable cloud model.",
          checklist: [{ text: "Capture flows" }, { text: "Define visual direction" }, { text: "Produce build-ready handoff" }],
        }),
        createTask("03", "Build orchestration", "orchestrator", {
          workflow: "vibe-build",
          preferredAgent: "orchestrator",
          checklist: [{ text: "Break work into tasks" }, { text: "Dispatch specialists" }, { text: "Review and iterate" }],
        }),
      ];
      const paths = await writeOrchestratorSession(ctx.cwd, sessionId, title, tasks);
      await updateState(ctx, () => {
        state.activeSessionId = sessionId;
        state.stage = "build";
        state.workflow = "vibe-build";
        state.role = "orchestrator";
      }, `Takomi kickoff created session ${sessionId}`);
      ctx.ui.notify(`Master plan: ${paths.masterPlan}`, "info");
    },
  });

  pi.registerCommand("autoorch", {
    description: "Toggle lightweight automatic orchestration routing",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.autoOrch = !state.autoOrch;
      }, () => `Takomi auto-orchestrator ${state.autoOrch ? "enabled" : "disabled"}`);
    },
  });

  pi.registerCommand("takomi-plan", {
    description: "Toggle lightweight Takomi planning bias",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.planMode = !state.planMode;
      }, () => `Takomi plan mode ${state.planMode ? "enabled" : "disabled"}`);
    },
  });

  pi.registerCommand("takomi-reset", {
    description: "Reset Takomi runtime state to defaults",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state = cloneState(DEFAULT_STATE);
      }, "Takomi runtime state reset");
    },
  });

  pi.registerTool({
    name: "takomi_workflow",
    label: "Takomi Workflow",
    description: "Return embedded Takomi workflow playbooks for genesis, design, and build.",
    promptSnippet: "Get embedded Takomi lifecycle playbooks without relying on external skill files.",
    parameters: Type.Object({
      workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
    }),
    async execute(_toolCallId, params) {
      if (params.workflow) {
        const workflow = getWorkflowDefinition(params.workflow);
        return {
          content: [{ type: "text", text: `${workflow.title}\n\n${workflow.playbook}` }],
          details: workflow,
        };
      }

      const workflows = listWorkflowDefinitions();
      return {
        content: [{ type: "text", text: workflows.map((workflow) => `${workflow.id}: ${workflow.purpose}`).join("\n") }],
        details: undefined,
      };
    },
  });

  pi.registerTool({
    name: "takomi_board",
    label: "Takomi Board",
    description: "Create and manage lightweight Takomi orchestrator session artifacts.",
    promptSnippet: "Create an orchestrator session board and task files for Vibe Build.",
    promptGuidelines: [
      "Use this when you need a concrete orchestrator session directory and task artifacts on disk.",
      "If a reviewed task needs more work, keep or reuse its conversationId so the same subagent can continue it.",
    ],
    parameters: Type.Object({
      action: StringEnum(["init_session", "show_workflows", "show_session", "update_task", "redispatch_task", "review_and_redispatch"] as const),
      title: Type.Optional(Type.String()),
      sessionId: Type.Optional(Type.String()),
      taskId: Type.Optional(Type.String()),
      status: Type.Optional(StringEnum(["pending", "in-progress", "completed", "blocked"] as const)),
      notes: Type.Optional(Type.String()),
      rerunInstructions: Type.Optional(Type.String()),
      checklistUpdates: Type.Optional(Type.Array(Type.Object({
        text: Type.Optional(Type.String()),
        index: Type.Optional(Type.Number()),
        done: Type.Optional(Type.Boolean()),
      }))),
      tasks: Type.Optional(Type.Array(Type.Object({
        id: Type.String(),
        title: Type.String(),
        role: StringEnum(["general", "orchestrator", "architect", "design", "code", "review"] as const),
        workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
        preferredAgent: Type.Optional(Type.String()),
        preferredModel: Type.Optional(Type.String()),
        preferredModelHint: Type.Optional(Type.String()),
        skills: Type.Optional(Type.Array(Type.String())),
        checklist: Type.Optional(Type.Array(Type.Union([
          Type.String(),
          Type.Object({
            text: Type.String(),
            done: Type.Optional(Type.Boolean()),
          }),
        ]))),
        conversationId: Type.Optional(Type.String()),
      }))),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (params.action === "show_workflows") {
        const workflows = listWorkflowDefinitions();
        return {
          content: [{ type: "text", text: workflows.map((workflow) => `${workflow.id}: ${workflow.playbook}`).join("\n\n") }],
          details: { workflows },
        };
      }

      if (params.action === "show_session") {
        if (!params.sessionId) {
          return { content: [{ type: "text", text: "sessionId is required for show_session" }], details: {}, isError: true };
        }
        const paths = getSessionPaths(ctx.cwd, params.sessionId);
        const [masterPlan, stateJson] = await Promise.all([
          readFile(paths.masterPlan, "utf8").catch(() => "Master plan not found."),
          readFile(paths.stateFile, "utf8").catch(() => "{}"),
        ]);
        return {
          content: [{ type: "text", text: `${masterPlan}\n\n---\n\nMachine state\n\n\
${stateJson}` }],
          details: { paths, state: JSON.parse(stateJson) },
        };
      }

      if (params.action === "update_task") {
        if (!params.sessionId || !params.taskId) {
          return { content: [{ type: "text", text: "sessionId and taskId are required for update_task" }], details: {}, isError: true };
        }
        const { title, tasks } = await loadSessionState(ctx.cwd, params.sessionId);
        const idx = tasks.findIndex((task) => task.id === params.taskId);
        if (idx === -1) {
          return { content: [{ type: "text", text: `Task ${params.taskId} not found in session ${params.sessionId}` }], details: {}, isError: true };
        }
        const current = tasks[idx];
        tasks[idx] = {
          ...current,
          status: (params.status ?? current.status) as OrchestratorTaskStatus,
          notes: params.notes ?? current.notes,
          checklist: applyChecklistUpdates(current.checklist, params.checklistUpdates),
        };
        const paths = await syncTaskArtifacts(ctx.cwd, params.sessionId, title, tasks);
        return {
          content: [{ type: "text", text: `Updated task ${params.taskId} in session ${params.sessionId}.\nStatus: ${tasks[idx].status}` }],
          details: { sessionId: params.sessionId, task: tasks[idx], paths },
        };
      }

      if (params.action === "redispatch_task" || params.action === "review_and_redispatch") {
        if (!params.sessionId || !params.taskId) {
          return { content: [{ type: "text", text: "sessionId and taskId are required for redispatch_task" }], details: {}, isError: true };
        }
        const { title, tasks } = await loadSessionState(ctx.cwd, params.sessionId);
        const task = tasks.find((item) => item.id === params.taskId);
        if (!task) {
          return { content: [{ type: "text", text: `Task ${params.taskId} not found in session ${params.sessionId}` }], details: {}, isError: true };
        }
        const agentName = resolveTaskAgent(task);
        const agents: TakomiAgentConfig[] = discoverProjectAgents(ctx.cwd);
        const config = agents.find((agent: TakomiAgentConfig) => agent.name === agentName);
        if (!config) {
          return { content: [{ type: "text", text: `Preferred agent '${agentName}' not found.` }], details: { availableAgents: agents.map((agent: TakomiAgentConfig) => agent.name) }, isError: true };
        }

        task.status = "in-progress";
        task.checklist = applyChecklistUpdates(task.checklist, params.checklistUpdates);
        if (params.action === "review_and_redispatch") {
          task.notes = appendTaskNote(task.notes, "Review feedback", params.notes);
        } else if (params.notes) {
          task.notes = params.notes;
        }
        const paths = await syncTaskArtifacts(ctx.cwd, params.sessionId, title, tasks);

        if (ctx.hasUI) {
          ctx.ui.setStatus("takomi-subagent", ctx.ui.theme.fg("accent", `↺ ${agentName}:${task.id}`));
          ctx.ui.setWidget("takomi-subagent", [
            ctx.ui.theme.fg("muted", "Takomi Active Subagent"),
            `agent: ${agentName}`,
            `task: ${task.id} — ${task.title}`,
            `workflow: ${task.workflow ?? "-"}`,
            `conversation: ${task.conversationId ?? "-"}`,
          ], { placement: "belowEditor" });
        }

        const promptPath = await writeTempPrompt(config.name, [
          config.systemPrompt,
          task.workflow ? `\nUse the ${task.workflow} workflow for this task.` : "",
          task.skills?.length ? `\nUse these skills when relevant: ${task.skills.join(", ")}.` : "",
        ].filter(Boolean).join("\n"));
        const sessionPath = path.join(ctx.cwd, ".pi", "takomi", "subagents", `${task.conversationId}.jsonl`);
        await mkdir(path.dirname(sessionPath), { recursive: true });
        const resolvedModel = await resolvePreferredModel(ctx, task.preferredModel, config.model);
        if (resolvedModel.model) task.preferredModel = resolvedModel.model;
        if (resolvedModel.warning) {
          task.notes = appendTaskNote(task.notes, "Model fallback", resolvedModel.warning);
          if (ctx.hasUI) ctx.ui.notify(resolvedModel.warning, "warning");
        }
        const args = ["--append-system-prompt", promptPath, "-p", buildSubagentTaskPrompt(task, params.rerunInstructions), "--session", sessionPath];
        if (resolvedModel.model) args.unshift("--model", resolvedModel.model);
        if (config.tools?.length) args.unshift("--tools", config.tools.join(","));
        const result = await runPiAgent(ctx.cwd, args, _signal);

        if (ctx.hasUI) {
          ctx.ui.setStatus("takomi-subagent", undefined);
          ctx.ui.setWidget("takomi-subagent", undefined);
        }

        if (result.code !== 0) {
          task.status = "blocked";
          task.notes = appendTaskNote(task.notes, "Redispatch failure", result.stderr.trim() || result.stdout.trim());
          await syncTaskArtifacts(ctx.cwd, params.sessionId, title, tasks);
          return {
            content: [{ type: "text", text: `Redispatch failed for task ${task.id}.\n\n${result.stderr || result.stdout || "No output"}` }],
            details: { sessionId: params.sessionId, task, paths },
            isError: true,
          };
        }

        task.notes = appendTaskNote(task.notes, "Last redispatch output", result.stdout.trim());
        await syncTaskArtifacts(ctx.cwd, params.sessionId, title, tasks);
        return {
          content: [{ type: "text", text: result.stdout.trim() || `Redispatched task ${task.id} to ${agentName}.` }],
          details: { sessionId: params.sessionId, task, paths, agent: agentName, conversationId: task.conversationId, action: params.action },
        };
      }

      const sessionId = params.sessionId || createSessionId();
      const title = params.title || "Takomi Build Session";
      const tasks = await Promise.all((params.tasks ?? []).map(async (task) => {
        const resolvedModel = await resolvePreferredModel(ctx, task.preferredModel);
        return createTask(task.id, task.title, task.role, {
          workflow: task.workflow,
          preferredAgent: task.preferredAgent,
          preferredModel: resolvedModel.model,
          preferredModelHint: [task.preferredModelHint, resolvedModel.warning].filter(Boolean).join(" ").trim() || undefined,
          skills: task.skills,
          checklist: (task.checklist ?? []).map((item) => typeof item === "string" ? { text: item } : item),
          conversationId: task.conversationId,
        });
      }));
      const paths = await writeOrchestratorSession(ctx.cwd, sessionId, title, tasks);
      state.activeSessionId = sessionId;
      persistState();

      return {
        content: [{ type: "text", text: `Created Takomi orchestrator session ${sessionId} in hybrid mode\n\nDocs: ${paths.root}\nState: ${paths.stateFile}\n\n${buildTaskRows(tasks) || "No tasks provided."}` }],
        details: { sessionId, paths, tasks, mode: "hybrid" },
      };
    },
  });

  pi.on("input", async (event) => {
    if (event.source === "extension") return { action: "continue" };

    const text = event.text.trim();
    const lowered = text.toLowerCase();

    if (lowered === "use takomi") {
      state.enabled = true;
      return { action: "transform", text: "Use the Takomi runtime, identify the correct lifecycle stage, and proceed accordingly." };
    }

    if (lowered.startsWith("use takomi ")) {
      state.enabled = true;
      const route = decideRoute(text.slice("use takomi ".length));
      if (route.stage) setStageAndWorkflow(state, route.stage);
      else if (route.role !== "general") state.role = route.role;
      return { action: "transform", text: `Use the Takomi runtime for this request: ${text.slice("use takomi ".length)}` };
    }

    if (/\bvibe genesis\b/i.test(text)) {
      setStageAndWorkflow(state, "genesis");
      return { action: "transform", text };
    }
    if (/\bvibe design\b/i.test(text)) {
      setStageAndWorkflow(state, "design");
      return { action: "transform", text };
    }
    if (/\bvibe build\b/i.test(text)) {
      setStageAndWorkflow(state, "build");
      return { action: "transform", text };
    }

    return { action: "continue" };
  });

  pi.on("before_agent_start", async (event) => {
    if (!state.enabled) return;

    let effectiveState = cloneState(state);
    if (state.autoOrch && shouldAutoRoute(event.prompt)) {
      effectiveState.role = "orchestrator";
      effectiveState.stage = "build";
      effectiveState.workflow = "vibe-build";
    }

    const route = decideRoute(event.prompt);
    if (!effectiveState.stage && route.stage) {
      effectiveState.stage = route.stage;
      effectiveState.workflow = route.workflow;
      effectiveState.role = route.role;
    }

    const parts = [
      "Takomi runtime is active for this turn.",
      rolePrompt(effectiveState.role),
      effectiveState.planMode ? planPrompt() : "",
      getInjectedPlaybook(effectiveState),
      `Routing note: ${route.reason}`,
      "When useful, state the current Takomi stage and the recommended next stage.",
      effectiveState.stage === "build"
        ? "For build orchestration, it is valid to dispatch tasks to specialist subagents, review them, and send fixes back to the same agent by reusing its conversation id."
        : "",
    ].filter(Boolean);

    return {
      systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as { type: string; customType?: string; data?: TakomiState };
      if (entry.type === "custom" && entry.customType === STATE_ENTRY && entry.data) {
        state = { ...DEFAULT_STATE, ...entry.data };
        break;
      }
    }

    await refreshUi(ctx, state);
  });
}

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import {
  buildSessionState,
  createSessionId,
  createLifecycleStarterSession,
  createTask,
  decideRoute,
  getSessionPaths,
  getNextTaskId,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  markStageExpanded,
  normalizeSessionState,
  renderMasterPlan,
  renderTaskFile,
  serializeSessionState,
  slugifyTaskTitle,
  type OrchestratorTask,
  type OrchestratorSessionState,
  type OrchestratorTaskStatus,
  type TakomiRole,
  type TakomiWorkflowId,
  type VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import { discoverProjectAgents, type TakomiAgentConfig } from "../takomi-subagents/agents";
import {
  renderRuntimeStatus,
  renderRuntimeWidget,
  TakomiFooterComponent,
} from "./ui";
import { getTakomiSubagentController } from "./subagent-controller";
import {
  TAKOMI_SUBAGENT_EVENT_CHANNEL,
  type TakomiSubagentRunPatch,
  type TakomiSubagentRuntimeEvent,
} from "./subagent-types";
import {
  visibleWidth,
  truncateToWidth,
  formatFooterNumber,
  writeTempPrompt,
  buildTaskPrompt,
  runPiAgentJson,
  resolvePreferredModel,
  runModelPreflight,
} from "./shared";
import { TakomiContextPanel, wireContextPanel } from "./context-panel";

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

function setStageAndWorkflow(state: TakomiState, stage: VibeLifecycleStage, options?: { preserveRole?: boolean }) {
  state.stage = stage;
  state.workflow = stage === "genesis" ? "vibe-genesis" : stage === "design" ? "vibe-design" : "vibe-build";
  if (!options?.preserveRole) {
    state.role = stage === "design" ? "design" : stage === "build" ? "orchestrator" : "architect";
  }
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
  return tasks.map((task) => `${task.id}: ${task.stage ?? "-"} | ${task.title} [${task.status}] -> ${task.preferredAgent ?? task.role}${task.conversationId ? ` (${task.conversationId})` : ""}${task.workflow ? ` | workflow=${task.workflow}` : ""}${task.preferredModel ? ` | model=${task.preferredModel}` : ""}${task.skills?.length ? ` | skills=${task.skills.join(",")}` : ""}`).join("\n");
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

function normalizeChecklistInput(
  checklist?: Array<string | { text: string; done?: boolean }>,
): OrchestratorTask["checklist"] {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

function resolveChecklistState(
  current: OrchestratorTask["checklist"],
  nextChecklist?: Array<string | { text: string; done?: boolean }>,
  updates?: Array<{ text?: string; index?: number; done?: boolean }>,
): OrchestratorTask["checklist"] {
  const baseChecklist = nextChecklist ? normalizeChecklistInput(nextChecklist) : current;
  return applyChecklistUpdates(baseChecklist, updates);
}

function getIncompleteChecklistItems(checklist?: OrchestratorTask["checklist"]): string[] {
  return (checklist ?? [])
    .filter((item) => !item.done)
    .map((item) => item.text);
}

function getCompletionGateError(task: Pick<OrchestratorTask, "id" | "title" | "checklist">): string | undefined {
  if (!task.checklist?.length) {
    return `Task ${task.id} cannot be marked completed until it has a checklist.`;
  }
  const incompleteItems = getIncompleteChecklistItems(task.checklist);
  if (incompleteItems.length === 0) return undefined;
  return [
    `Task ${task.id} cannot be marked completed until every checklist item is done.`,
    "",
    "Incomplete checklist items:",
    ...incompleteItems.map((item) => `- ${item}`),
  ].join("\n");
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

function buildSubagentTaskPrompt(task: OrchestratorTask, extraInstructions?: string): string {
  return buildTaskPrompt({
    task: extraInstructions?.trim() || task.notes || task.title,
    workflow: task.workflow,
    skills: task.skills,
    checklist: task.checklist,
    stage: task.stage,
  });
}

async function hasGenesisArtifacts(cwd: string): Promise<boolean> {
  try {
    await readFile(path.join(cwd, "docs", "Project_Requirements.md"), "utf8");
    await readFile(path.join(cwd, "docs", "Coding_Guidelines.md"), "utf8");
    const issues = await readdir(path.join(cwd, "docs", "issues"));
    return issues.some((entry) => entry.endsWith(".md"));
  } catch {
    return false;
  }
}

async function loadSessionState(cwd: string, sessionId: string): Promise<{ state: OrchestratorSessionState; paths: ReturnType<typeof getSessionPaths> }> {
  const paths = getSessionPaths(cwd, sessionId);
  const raw = await readFile(paths.stateFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<OrchestratorSessionState>;
  const state = normalizeSessionState({
    sessionId,
    title: parsed.title ?? "Takomi Session",
    ...parsed,
  });
  return { state, paths };
}

async function syncTaskArtifacts(cwd: string, session: OrchestratorSessionState) {
  const normalizedState = normalizeSessionState(session);
  const paths = getSessionPaths(cwd, normalizedState.sessionId);
  await mkdir(paths.pending, { recursive: true });
  await mkdir(paths.inProgress, { recursive: true });
  await mkdir(paths.completed, { recursive: true });
  await mkdir(paths.blocked, { recursive: true });
  await mkdir(paths.stateDir, { recursive: true });
  await writeFile(paths.masterPlan, renderMasterPlan(normalizedState), "utf8");
  await writeFile(paths.summary, [
    `# Orchestrator Summary: ${normalizedState.title}`,
    "",
    `- Session ID: ${normalizedState.sessionId}`,
    `- Human docs: ${paths.root}`,
    `- Machine state: ${paths.stateFile}`,
    `- Runtime mode: ${normalizedState.mode}`,
    `- Session intent: ${normalizedState.sessionIntent ?? "full-project"}`,
  ].join("\n"), "utf8");
  await writeFile(paths.stateFile, serializeSessionState(normalizedState), "utf8");

  for (const folder of [paths.pending, paths.inProgress, paths.completed, paths.blocked]) {
    const entries = await readdir(folder).catch(() => [] as string[]);
    for (const entry of entries) {
      if (entry.endsWith(".task.md")) {
        await rm(path.join(folder, entry), { force: true });
      }
    }
  }

  for (const task of normalizedState.tasks) {
    const filePath = path.join(getTaskFolder(paths, task.status), getTaskFileName(task));
    await writeFile(filePath, renderTaskFile(task, `Parent session: ${normalizedState.sessionId}\n\nTask title: ${task.title}`), "utf8");
  }

  return paths;
}

async function writeOrchestratorSession(cwd: string, session: OrchestratorSessionState) {
  return syncTaskArtifacts(cwd, session);
}

type IncomingTask = {
  id?: string;
  title: string;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  parentTaskId?: string;
  preferredAgent?: string;
  preferredModel?: string;
  preferredModelHint?: string;
  skills?: string[];
  checklist?: Array<string | { text: string; done?: boolean }>;
  objective?: string;
  scope?: string[];
  definitionOfDone?: string[];
  expectedArtifacts?: string[];
  dependencies?: string[];
  reviewCheckpoint?: string;
  instructions?: string[];
  conversationId?: string;
};

async function materializeTasksFromInput(
  ctx: ExtensionContext,
  currentTasks: OrchestratorTask[],
  incoming: IncomingTask[],
  stageOverride?: VibeLifecycleStage,
): Promise<OrchestratorTask[]> {
  const nextTasks = [...currentTasks];

  for (const task of incoming) {
    const resolvedModel = await resolvePreferredModel(ctx, task.preferredModel);
    const id = task.id ?? getNextTaskId(nextTasks);
    nextTasks.push(createTask(id, task.title, task.role, {
      stage: task.stage ?? stageOverride,
      workflow: task.workflow,
      parentTaskId: task.parentTaskId,
      preferredAgent: task.preferredAgent,
      preferredModel: resolvedModel.model,
      preferredModelHint: [task.preferredModelHint, resolvedModel.warning].filter(Boolean).join(" ").trim() || undefined,
      skills: task.skills,
      checklist: (task.checklist ?? []).map((item) => typeof item === "string" ? { text: item } : item),
      objective: task.objective,
      scope: task.scope,
      definitionOfDone: task.definitionOfDone,
      expectedArtifacts: task.expectedArtifacts,
      dependencies: task.dependencies,
      reviewCheckpoint: task.reviewCheckpoint,
      instructions: task.instructions,
      conversationId: task.conversationId,
    }));
  }

  return nextTasks;
}

// stripAnsi, visibleWidth, truncateToWidth, formatFooterNumber
// are imported from "./shared"

function installTakomiFooter(ctx: ExtensionContext, stateRef: { current: TakomiState }): void {
  ctx.ui.setFooter((tui, theme, footerData) => new TakomiFooterComponent(tui, theme, footerData, ctx, () => stateRef.current));
  return;
  ctx.ui.setFooter((_tui, theme, footerData) => ({
    invalidate() {},
    render(width: number): string[] {
      const state = stateRef.current;
      let input = 0;
      let output = 0;
      let cost = 0;
      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type === "message" && entry.message.role === "assistant") {
          const message = entry.message as AssistantMessage;
          input += message.usage.input;
          output += message.usage.output;
          cost += message.usage.cost.total;
        }
      }

      const cwd = theme.fg("dim", ctx.cwd);
      const stats = theme.fg("dim", `↑${formatFooterNumber(input)} ↓${formatFooterNumber(output)} $${cost.toFixed(3)}`);
      const leftPad = " ".repeat(Math.max(1, width - visibleWidth(cwd) - visibleWidth(stats)));
      const topLine = truncateToWidth(cwd + leftPad + stats, width);

      const extensionStatuses = [...footerData.getExtensionStatuses().entries()]
        .filter(([key]) => key !== "takomi-runtime")
        .map(([, value]) => value)
        .filter(Boolean);
      const runtimeStatus = renderRuntimeStatus(theme, state);
      const left = [runtimeStatus, ...extensionStatuses].join(theme.fg("dim", "  ·  "));
      const right = theme.fg("dim", ctx.model?.id || "no-model");
      const rightPad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
      const bottomLine = truncateToWidth(left + rightPad + right, width);

      return [topLine, bottomLine];
    },
  }));
}

// Mutable state ref so the footer closure always reads the latest state
const footerStateRef: { current: TakomiState; installed: boolean } = { current: cloneState(DEFAULT_STATE), installed: false };

async function refreshUi(ctx: ExtensionContext, state: TakomiState) {
  if (!ctx.hasUI) return;
  footerStateRef.current = state;
  ctx.ui.setStatus("takomi-runtime", renderRuntimeStatus(ctx.ui.theme, state));
  const widget = renderRuntimeWidget(ctx.ui.theme, state);
  ctx.ui.setWidget("takomi-runtime", widget.length > 0 ? widget : undefined);
  if (!footerStateRef.installed) {
    installTakomiFooter(ctx, footerStateRef);
    footerStateRef.installed = true;
  }
}

export default function takomiRuntime(pi: ExtensionAPI) {
  let state = cloneState(DEFAULT_STATE);
  const subagentController = getTakomiSubagentController();
  const contextPanel = new TakomiContextPanel();
  let runtimeCtx: ExtensionContext | undefined;
  const pendingSubagentEvents: TakomiSubagentRuntimeEvent[] = [];

  // Wire context panel events and commands (Alt+C, /takomi-context)
  wireContextPanel(pi, contextPanel);

  pi.events.on(TAKOMI_SUBAGENT_EVENT_CHANNEL, (payload) => {
    const event = payload as TakomiSubagentRuntimeEvent;
    if (!runtimeCtx) {
      pendingSubagentEvents.push(event);
      return;
    }
    void applySubagentRuntimeEvent(event, runtimeCtx);
  });

  function persistState() {
    pi.appendEntry(STATE_ENTRY, state);
  }

  function syncContextPanelState() {
    contextPanel.setRuntimeState({
      role: state.role,
      stage: state.stage,
      workflow: state.workflow,
      activeSessionId: state.activeSessionId,
      autoOrch: state.autoOrch,
      planMode: state.planMode,
    });
  }

  async function applySubagentRuntimeEvent(event: TakomiSubagentRuntimeEvent, ctx: ExtensionContext): Promise<void> {
    switch (event.type) {
      case "start":
        await subagentController.start(ctx, event.state, event.runKey);
        break;
      case "update":
        await subagentController.update(ctx, event.patch, event.runKey);
        break;
      case "appendLog":
        await subagentController.appendLog(ctx, event.chunk, event.runKey);
        break;
      case "complete":
        await subagentController.complete(ctx, event.patch, event.runKey);
        break;
      case "block":
        await subagentController.block(ctx, event.patch, event.runKey);
        break;
    }
  }

  function flushPendingSubagentEvents(): void {
    if (!runtimeCtx || pendingSubagentEvents.length === 0) return;
    const queued = pendingSubagentEvents.splice(0, pendingSubagentEvents.length);
    for (const event of queued) {
      void applySubagentRuntimeEvent(event, runtimeCtx);
    }
  }

  async function updateState(ctx: ExtensionContext, mutator: () => void, message?: string | (() => string)) {
    mutator();
    persistState();
    syncContextPanelState();
    await refreshUi(ctx, state);
    const resolvedMessage = typeof message === "function" ? message() : message;
    if (resolvedMessage) ctx.ui.notify(resolvedMessage, "info");
  }

  async function syncBoardTaskRunState(
    ctx: ExtensionContext,
    task: Pick<OrchestratorTask, "conversationId" | "status" | "checklist">,
    summary?: string,
  ): Promise<void> {
    if (!task.conversationId) return;
    const patch: TakomiSubagentRunPatch = {
      conversationId: task.conversationId,
      boardTaskStatus: task.status,
      checklist: task.checklist,
    };
    if (summary) patch.summary = summary;
    await subagentController.update(ctx, patch, task.conversationId);
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
      const hasGenesis = await hasGenesisArtifacts(ctx.cwd);
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "orchestrator";
        state.stage = hasGenesis ? "build" : "genesis";
        state.workflow = hasGenesis ? "vibe-build" : "vibe-genesis";
      }, hasGenesis ? "Takomi role set to orchestrator" : "Takomi role set to orchestrator (Genesis-first: project foundation missing)");
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
      await updateState(ctx, () => setStageAndWorkflow(state, "genesis", { preserveRole: state.role === "orchestrator" }), "Takomi stage set to Vibe Genesis");
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
      const session = createLifecycleStarterSession(title);
      const paths = await writeOrchestratorSession(ctx.cwd, session);
      await updateState(ctx, () => {
        state.activeSessionId = session.sessionId;
        state.stage = "genesis";
        state.workflow = "vibe-genesis";
        state.role = "orchestrator";
      }, `Takomi kickoff created session ${session.sessionId}`);
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

  pi.registerCommand("takomi-subagent-expand", {
    description: "Expand the live Takomi subagent surface",
    handler: async (_args, ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      subagentController.setViewMode("expanded", ctx);
      ctx.ui.notify("Takomi subagent view expanded", "info");
    },
  });

  pi.registerCommand("takomi-subagent-collapse", {
    description: "Collapse the live Takomi subagent surface",
    handler: async (_args, ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      subagentController.setViewMode("compact", ctx);
      ctx.ui.notify("Takomi subagent view collapsed", "info");
    },
  });

  pi.registerCommand("takomi-subagent-toggle", {
    description: "Cycle the live Takomi subagent surface: compact → expanded → fullscreen",
    handler: async (_args, ctx) => {
      const mode = subagentController.cycleViewMode(ctx);
      if (!mode) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      ctx.ui.notify(`Takomi subagent view ${mode}`, "info");
    },
  });

  pi.registerCommand("takomi-subagent-fullscreen", {
    description: "Show the Takomi subagent in fullscreen overlay",
    handler: async (_args, ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      subagentController.setViewMode("fullscreen", ctx);
      ctx.ui.notify("Takomi subagent view fullscreen", "info");
    },
  });

  pi.registerCommand("takomi-subagent-next", {
    description: "Switch focus to the next tracked Takomi subagent",
    handler: async (_args, ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      const changed = subagentController.cycleFocus("next", ctx);
      ctx.ui.notify(changed ? "Takomi subagent focus advanced" : "No additional Takomi subagents to cycle", changed ? "info" : "warning");
    },
  });

  pi.registerCommand("takomi-subagent-prev", {
    description: "Switch focus to the previous tracked Takomi subagent",
    handler: async (_args, ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      const changed = subagentController.cycleFocus("prev", ctx);
      ctx.ui.notify(changed ? "Takomi subagent focus moved back" : "No additional Takomi subagents to cycle", changed ? "info" : "warning");
    },
  });

  pi.registerShortcut("alt+t", {
    description: "Cycle Takomi subagent detail (compact -> expanded -> fullscreen)",
    handler: async (ctx) => {
      const mode = subagentController.cycleViewMode(ctx);
      if (!mode) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      ctx.ui.notify(`Takomi subagent view ${mode}`, "info");
    },
  });

  pi.registerShortcut("alt+shift+t", {
    description: "Open Takomi subagent fullscreen overlay",
    handler: async (ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      subagentController.setViewMode("fullscreen", ctx);
      ctx.ui.notify("Takomi subagent view fullscreen", "info");
    },
  });

  pi.registerShortcut("alt+n", {
    description: "Switch to the next Takomi subagent",
    handler: async (ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      const changed = subagentController.cycleFocus("next", ctx);
      if (!changed) ctx.ui.notify("No additional Takomi subagents to cycle", "warning");
    },
  });

  pi.registerShortcut("alt+p", {
    description: "Switch to the previous Takomi subagent",
    handler: async (ctx) => {
      if (!subagentController.hasRuns()) {
        ctx.ui.notify("No active Takomi subagent", "warning");
        return;
      }
      const changed = subagentController.cycleFocus("prev", ctx);
      if (!changed) ctx.ui.notify("No additional Takomi subagents to cycle", "warning");
    },
  });

  pi.registerCommand("takomi-reset", {
    description: "Reset Takomi runtime state to defaults",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state = cloneState(DEFAULT_STATE);
      }, "Takomi runtime state reset");
      subagentController.reset(ctx);
      contextPanel.resetSession();
      contextPanel.show(ctx);
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
    description: "Create and manage lifecycle-aware Takomi orchestration session artifacts.",
    promptSnippet: "Create or expand a Genesis -> Design -> Build orchestration session only when the work is large enough to merit it.",
    promptGuidelines: [
      "Use this when you need a concrete orchestrator session directory and task artifacts on disk.",
      "A new session should normally begin Genesis-first, then expand Design and Build into as many tasks as the scope actually needs.",
      "If the request is small enough, do not force orchestration just because the tool exists.",
      "If a reviewed task needs more work, keep or reuse its conversationId so the same subagent can continue it.",
    ],
    parameters: Type.Object({
      action: StringEnum(["init_session", "expand_stage", "show_workflows", "show_session", "update_task", "redispatch_task", "review_and_redispatch"] as const),
      title: Type.Optional(Type.String()),
      sessionId: Type.Optional(Type.String()),
      taskId: Type.Optional(Type.String()),
      stage: Type.Optional(StringEnum(["genesis", "design", "build"] as const)),
      status: Type.Optional(StringEnum(["pending", "in-progress", "completed", "blocked"] as const)),
      notes: Type.Optional(Type.String()),
      rerunInstructions: Type.Optional(Type.String()),
      checklist: Type.Optional(Type.Array(Type.Union([
        Type.String(),
        Type.Object({ text: Type.String(), done: Type.Optional(Type.Boolean()) }),
      ]))),
      checklistUpdates: Type.Optional(Type.Array(Type.Object({
        text: Type.Optional(Type.String()),
        index: Type.Optional(Type.Number()),
        done: Type.Optional(Type.Boolean()),
      }))),
      tasks: Type.Optional(Type.Array(Type.Object({
        id: Type.Optional(Type.String()),
        title: Type.String(),
        role: StringEnum(["general", "orchestrator", "architect", "design", "code", "review"] as const),
        stage: Type.Optional(StringEnum(["genesis", "design", "build"] as const)),
        workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
        parentTaskId: Type.Optional(Type.String()),
        preferredAgent: Type.Optional(Type.String()),
        preferredModel: Type.Optional(Type.String()),
        preferredModelHint: Type.Optional(Type.String()),
        skills: Type.Optional(Type.Array(Type.String())),
        checklist: Type.Optional(Type.Array(Type.Union([
          Type.String(),
          Type.Object({ text: Type.String(), done: Type.Optional(Type.Boolean()) }),
        ]))),
        objective: Type.Optional(Type.String()),
        scope: Type.Optional(Type.Array(Type.String())),
        definitionOfDone: Type.Optional(Type.Array(Type.String())),
        expectedArtifacts: Type.Optional(Type.Array(Type.String())),
        dependencies: Type.Optional(Type.Array(Type.String())),
        reviewCheckpoint: Type.Optional(Type.String()),
        instructions: Type.Optional(Type.Array(Type.String())),
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
          details: { paths, state: normalizeSessionState({ sessionId: params.sessionId, title: "Takomi Session", ...(JSON.parse(stateJson) as Partial<OrchestratorSessionState>) }) },
        };
      }

      if (params.action === "update_task") {
        if (!params.sessionId || !params.taskId) {
          return { content: [{ type: "text", text: "sessionId and taskId are required for update_task" }], details: {}, isError: true };
        }
        const { state: sessionState } = await loadSessionState(ctx.cwd, params.sessionId);
        const idx = sessionState.tasks.findIndex((task) => task.id === params.taskId);
        if (idx === -1) {
          return { content: [{ type: "text", text: `Task ${params.taskId} not found in session ${params.sessionId}` }], details: {}, isError: true };
        }
        const current = sessionState.tasks[idx];
        const checklist = resolveChecklistState(current.checklist, params.checklist, params.checklistUpdates);
        const nextTask = {
          ...current,
          status: (params.status ?? current.status) as OrchestratorTaskStatus,
          notes: params.notes ?? current.notes,
          checklist,
        };
        if (params.status === "completed") {
          const completionGateError = getCompletionGateError(nextTask);
          if (completionGateError) {
            return {
              content: [{ type: "text", text: completionGateError }],
              details: {
                sessionId: params.sessionId,
                taskId: current.id,
                incompleteChecklistItems: getIncompleteChecklistItems(nextTask.checklist),
                checklist: nextTask.checklist,
              },
              isError: true,
            };
          }
        }
        sessionState.tasks[idx] = nextTask;
        const nextState = buildSessionState(
          sessionState.sessionId,
          sessionState.title,
          sessionState.tasks,
          new Date(),
          {
            sessionIntent: sessionState.sessionIntent,
            lifecycle: sessionState.lifecycle,
          },
        );
        const paths = await syncTaskArtifacts(ctx.cwd, nextState);
        await syncBoardTaskRunState(
          ctx,
          nextState.tasks[idx],
          nextTask.status === "completed"
            ? "Board task completed."
            : nextTask.status === "blocked"
              ? "Board task blocked."
              : undefined,
        );
        return {
          content: [{ type: "text", text: `Updated task ${params.taskId} in session ${params.sessionId}.\nStatus: ${nextState.tasks[idx].status}` }],
          details: { sessionId: params.sessionId, task: nextState.tasks[idx], paths, lifecycle: nextState.lifecycle },
        };
      }

      if (params.action === "redispatch_task" || params.action === "review_and_redispatch") {
        if (!params.sessionId || !params.taskId) {
          return { content: [{ type: "text", text: "sessionId and taskId are required for redispatch_task" }], details: {}, isError: true };
        }
        const { state: sessionState } = await loadSessionState(ctx.cwd, params.sessionId);
        const task = sessionState.tasks.find((item) => item.id === params.taskId);
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
        task.checklist = resolveChecklistState(task.checklist, params.checklist, params.checklistUpdates);
        if (params.action === "review_and_redispatch") {
          task.notes = appendTaskNote(task.notes, "Review feedback", params.notes);
        } else if (params.notes) {
          task.notes = params.notes;
        }
        let nextState = buildSessionState(
          sessionState.sessionId,
          sessionState.title,
          sessionState.tasks,
          new Date(),
          {
            sessionIntent: sessionState.sessionIntent,
            lifecycle: sessionState.lifecycle,
          },
        );
        const paths = await syncTaskArtifacts(ctx.cwd, nextState);
        const conversationId = task.conversationId ?? task.id;
        task.conversationId = conversationId;
        const runKey = conversationId;
        const parentRunKey = task.parentTaskId
          ? (() => {
              const parentTask = sessionState.tasks.find((item) => item.id === task.parentTaskId);
              if (parentTask) return parentTask.conversationId ?? parentTask.id;
              return subagentController.getKnownParentRunKey(task.parentTaskId);
            })()
          : undefined;

        await subagentController.start(ctx, {
          agent: agentName,
          taskLabel: `${task.id} - ${task.title}`,
          stage: task.stage,
          workflow: task.workflow,
          conversationId,
          parentTaskId: task.parentTaskId,
          parentRunKey,
          checklist: task.checklist,
          boardTaskStatus: task.status,
          summary: params.action === "review_and_redispatch"
            ? "Review feedback accepted. Relaunching the same specialist thread."
            : "Redispatching task to the preferred specialist.",
          source: "runtime-board",
        }, runKey);

        const promptPath = await writeTempPrompt(config.name, [
          config.systemPrompt,
          task.workflow ? `\nUse the ${task.workflow} workflow for this task.` : "",
          task.skills?.length ? `\nUse these skills when relevant: ${task.skills.join(", ")}.` : "",
        ].filter(Boolean).join("\n"));
        const sessionPath = path.join(ctx.cwd, ".pi", "takomi", "subagents", `${conversationId}.jsonl`);
        await mkdir(path.dirname(sessionPath), { recursive: true });
        const preflight = await runModelPreflight(ctx, ctx.cwd, task.preferredModel, config.model, _signal);
        task.notes = appendTaskNote(task.notes, "Model preflight", preflight.report);
        if (preflight.model) {
          task.preferredModel = preflight.model;
          await subagentController.update(ctx, { model: preflight.model, boardTaskStatus: task.status, checklist: task.checklist, summary: `Model ready: ${preflight.model}` }, runKey);
        }
        if (preflight.warning) {
          task.notes = appendTaskNote(task.notes, "Model fallback", preflight.warning);
          if (ctx.hasUI) ctx.ui.notify(preflight.warning, "warning");
          await subagentController.update(ctx, { boardTaskStatus: task.status, checklist: task.checklist, summary: preflight.warning }, runKey);
        }
        if (!preflight.model) {
          task.status = "blocked";
          nextState = buildSessionState(
            sessionState.sessionId,
            sessionState.title,
            sessionState.tasks,
            new Date(),
            {
              sessionIntent: sessionState.sessionIntent,
              lifecycle: sessionState.lifecycle,
            },
          );
          await syncTaskArtifacts(ctx.cwd, nextState);
          await subagentController.block(ctx, {
            model: task.preferredModel,
            boardTaskStatus: task.status,
            checklist: task.checklist,
            summary: "Redispatch blocked before launch.",
            logs: [...(task.notes ? [task.notes] : []), preflight.report],
          }, runKey);
          return {
            content: [{ type: "text", text: `Redispatch blocked before launch.\n\n${preflight.report}` }],
            details: { sessionId: params.sessionId, task, paths, preflight },
            isError: true,
          };
        }
        const args = ["--mode", "json", "--append-system-prompt", promptPath, "--session", sessionPath, buildSubagentTaskPrompt(task, params.rerunInstructions)];
        args.unshift("--model", preflight.model);
        if (config.tools?.length) args.unshift("--tools", config.tools.join(","));
        const result = await runPiAgentJson(ctx.cwd, args, _signal, {
          onAssistantText: (text) => {
            void subagentController.update(ctx, { outputText: text, boardTaskStatus: task.status, checklist: task.checklist }, runKey);
          },
          onEventText: (line) => {
            void subagentController.appendLog(ctx, line, runKey);
          },
          onStderr: (chunk) => {
            void subagentController.appendLog(ctx, chunk, runKey);
          },
        });

        if (result.code !== 0) {
          task.status = "blocked";
          task.notes = appendTaskNote(task.notes, "Redispatch failure", result.stderr.trim() || result.stdout.trim());
          nextState = buildSessionState(
            sessionState.sessionId,
            sessionState.title,
            sessionState.tasks,
            new Date(),
            {
              sessionIntent: sessionState.sessionIntent,
              lifecycle: sessionState.lifecycle,
            },
          );
          await syncTaskArtifacts(ctx.cwd, nextState);
          await subagentController.block(ctx, {
            model: task.preferredModel,
            boardTaskStatus: task.status,
            checklist: task.checklist,
            summary: `Redispatch failed for ${task.id}.`,
            outputText: result.stdout.trim() || undefined,
            logs: [result.stderr || result.stdout || "No output"],
          }, runKey);
          return {
            content: [{ type: "text", text: `Redispatch failed for task ${task.id}.\n\n${result.stderr || result.stdout || "No output"}` }],
            details: { sessionId: params.sessionId, task, paths },
            isError: true,
          };
        }

        task.notes = appendTaskNote(task.notes, "Last redispatch output", result.stdout.trim());
        await subagentController.complete(ctx, {
          model: task.preferredModel,
          boardTaskStatus: task.status,
          checklist: task.checklist,
          summary: result.stdout.trim() || `Subagent run finished for task ${task.id}. Board completion still requires checklist validation.`,
          outputText: result.stdout.trim() || undefined,
        }, runKey);
        nextState = buildSessionState(
          sessionState.sessionId,
          sessionState.title,
          sessionState.tasks,
          new Date(),
          {
            sessionIntent: sessionState.sessionIntent,
            lifecycle: sessionState.lifecycle,
          },
        );
        await syncTaskArtifacts(ctx.cwd, nextState);
        return {
          content: [{ type: "text", text: `${preflight.report}\n\n${result.stdout.trim() || `Redispatched task ${task.id} to ${agentName}.`}` }],
          details: { sessionId: params.sessionId, task, paths, lifecycle: nextState.lifecycle, agent: agentName, conversationId: task.conversationId, action: params.action, preflight },
        };
      }

      if (params.action === "expand_stage") {
        if (!params.sessionId || !params.stage || !params.tasks?.length) {
          return { content: [{ type: "text", text: "sessionId, stage, and at least one task are required for expand_stage" }], details: {}, isError: true };
        }

        const { state: sessionState } = await loadSessionState(ctx.cwd, params.sessionId);
        const tasks = await materializeTasksFromInput(ctx, sessionState.tasks, params.tasks as IncomingTask[], params.stage);
        let nextState = buildSessionState(
          sessionState.sessionId,
          sessionState.title,
          tasks,
          new Date(),
          {
            sessionIntent: sessionState.sessionIntent,
            lifecycle: sessionState.lifecycle,
          },
        );
        nextState = markStageExpanded(nextState, params.stage, params.notes);
        const paths = await writeOrchestratorSession(ctx.cwd, nextState);
        state.activeSessionId = nextState.sessionId;
        persistState();
        syncContextPanelState();

        return {
          content: [{ type: "text", text: `Expanded ${params.stage} stage in session ${nextState.sessionId}.\n\nDocs: ${paths.root}\nState: ${paths.stateFile}\n\n${buildTaskRows(nextState.tasks)}` }],
          details: { sessionId: nextState.sessionId, paths, tasks: nextState.tasks, lifecycle: nextState.lifecycle, mode: nextState.mode },
        };
      }

      const sessionId = params.sessionId || createSessionId();
      const title = params.title || "Takomi Session";
      const baseState = params.tasks?.length
        ? buildSessionState(sessionId, title, [], new Date())
        : createLifecycleStarterSession(title, { sessionId });
      const tasks = params.tasks?.length
        ? await materializeTasksFromInput(ctx, baseState.tasks, params.tasks as IncomingTask[], params.stage)
        : baseState.tasks;
      const nextState = buildSessionState(
        baseState.sessionId,
        baseState.title,
        tasks,
        new Date(),
        {
          sessionIntent: baseState.sessionIntent,
          lifecycle: baseState.lifecycle,
        },
      );
      const paths = await writeOrchestratorSession(ctx.cwd, nextState);
      state.activeSessionId = nextState.sessionId;
      state.role = "orchestrator";
      state.stage = nextState.lifecycle.genesis.status === "completed" ? "build" : "genesis";
      state.workflow = state.stage === "genesis" ? "vibe-genesis" : "vibe-build";
      persistState();
      syncContextPanelState();

      return {
        content: [{ type: "text", text: `Created Takomi orchestrator session ${nextState.sessionId} in hybrid mode\n\nDocs: ${paths.root}\nState: ${paths.stateFile}\n\n${buildTaskRows(nextState.tasks) || "No tasks provided."}` }],
        details: { sessionId: nextState.sessionId, paths, tasks: nextState.tasks, lifecycle: nextState.lifecycle, mode: nextState.mode },
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
      if (route.stage) setStageAndWorkflow(state, route.stage, { preserveRole: state.role === "orchestrator" && route.stage === "genesis" });
      else if (route.role !== "general") state.role = route.role;
      return { action: "transform", text: `Use the Takomi runtime for this request: ${text.slice("use takomi ".length)}` };
    }

    if (/\bvibe genesis\b/i.test(text)) {
      setStageAndWorkflow(state, "genesis", { preserveRole: state.role === "orchestrator" });
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
    const runtimeCwd = typeof (event as { cwd?: string }).cwd === "string" ? (event as { cwd?: string }).cwd as string : process.cwd();
    const genesisExists = await hasGenesisArtifacts(runtimeCwd);
    const route = decideRoute(event.prompt);
    if (state.autoOrch && shouldAutoRoute(event.prompt)) {
      effectiveState.role = "orchestrator";
      effectiveState.stage = genesisExists ? "build" : "genesis";
      effectiveState.workflow = genesisExists ? "vibe-build" : "vibe-genesis";
    }

    const shouldHonorRoute = route.stage || route.role !== "general" || route.sessionRecommendation !== "none";
    if (shouldHonorRoute && route.stage) {
      effectiveState.stage = route.stage;
      effectiveState.workflow = route.workflow;
      effectiveState.role = effectiveState.role === "orchestrator" && route.stage === "genesis" ? "orchestrator" : route.role;
    } else if (shouldHonorRoute && route.role !== "general") {
      effectiveState.role = route.role;
    }

    let routingNote = route.reason;
    const explicitLifecycleWaiver = /skip genesis|waive genesis|genesis complete|already have (a )?(prd|requirements)|design complete|jump straight to build/i.test(event.prompt);
    const orchestrationActive = effectiveState.role === "orchestrator" || route.executionMode === "orchestrate";
    if (!genesisExists && orchestrationActive && !explicitLifecycleWaiver) {
      effectiveState.stage = "genesis";
      effectiveState.workflow = "vibe-genesis";
      routingNote = "Blank project detected; orchestrator remains in control and must honor Genesis → Design → Build.";
    }

    const parts = [
      "Takomi runtime is active for this turn.",
      rolePrompt(effectiveState.role),
      effectiveState.planMode ? planPrompt() : "",
      getInjectedPlaybook(effectiveState),
      `Routing note: ${routingNote}`,
      `Execution mode: ${route.executionMode}. Session recommendation: ${route.sessionRecommendation}.`,
      !genesisExists ? "Project foundation is missing or incomplete. Do not skip Genesis unless the user explicitly waives it." : "",
      "Takomi is the default orchestration mindset here. Do not wait for the literal phrase 'use Takomi' before applying lifecycle judgment.",
      "Task fan-out is flexible. Do not force exactly three tasks; decompose Genesis, Design, and Build work to fit the actual scope.",
      "A new orchestration session should usually begin with one Genesis foundation task that creates or updates the required markdown artifacts, then expand later stages only when the scope justifies it.",
      "If a follow-up request is small, one-shot it. If it is multi-part or large, create or expand an orchestration session instead of pretending it is a single task.",
      "Before any subagent dispatch or model override, run and surface a visible `pi --list-models` preflight. Never fail silently on model availability.",
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
    runtimeCtx = ctx;
    subagentController.reset(ctx);
    contextPanel.resetSession();
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as { type: string; customType?: string; data?: TakomiState };
      if (entry.type === "custom" && entry.customType === STATE_ENTRY && entry.data) {
        state = { ...DEFAULT_STATE, ...entry.data };
        break;
      }
    }

    syncContextPanelState();
    await refreshUi(ctx, state);
    contextPanel.show(ctx);
    flushPendingSubagentEvents();
  });
}

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "typebox";
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
  renderValidationReport,
  serializeSessionState,
  slugifyTaskTitle,
  validateSessionState,
  type OrchestratorTask,
  type OrchestratorSessionState,
  type OrchestratorTaskStatus,
  type TakomiDispatchPolicy,
  type TakomiLaunchMode,
  type TakomiProfile,
  type TakomiRole,
  type TakomiThinkingLevel,
  type TakomiWorkflowId,
  type VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import {
  renderRuntimeStatus,
  renderRuntimeWidget,
  renderTakomiHeader,
  TakomiFooterComponent,
} from "./ui";
import { getTakomiSubagentController } from "./subagent-controller";
import {
  TAKOMI_SUBAGENT_EVENT_CHANNEL,
  type TakomiSubagentRunPatch,
  type TakomiSubagentRuntimeEvent,
} from "./subagent-types";
import {
  buildTaskPrompt,
  resolvePreferredModel,
} from "./shared";
import { TakomiContextPanel, wireContextPanel } from "./context-panel";
import { registerTakomiCommands } from "./commands";
import {
  DEFAULT_TAKOMI_PROFILE,
  getProfileDefaults,
  loadTakomiProfile,
} from "./profile";
import { installTakomiRoutingPolicy, resolveTakomiRoutingPolicy } from "./routing-policy";

type TakomiState = {
  enabled: boolean;
  autoOrch: boolean;
  launchMode: TakomiLaunchMode;
  planMode: boolean;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  activeSessionId?: string;
  subagentsEnabled: boolean;
  lastFullPromptKey?: string;
};

const DEFAULT_STATE: TakomiState = {
  enabled: true,
  autoOrch: true,
  launchMode: "auto",
  planMode: false,
  role: "general",
  subagentsEnabled: true,
};

const STATE_ENTRY = "takomi-runtime-state";

let activeProfile: TakomiProfile = DEFAULT_TAKOMI_PROFILE;
let activeSubagentLabel: string | undefined;

const ThinkingSchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

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
    `launch=${state.launchMode}`,
    `plan=${state.planMode ? "on" : "off"}`,
    `subagents=${state.subagentsEnabled ? "on" : "off"}`,
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

function fallbackRolePrompt(role: TakomiRole): string {
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

function agentFileNameForRole(role: TakomiRole): string | undefined {
  switch (role) {
    case "orchestrator": return "orchestrator.md";
    case "architect": return "architect.md";
    case "design": return "designer.md";
    case "code": return "coder.md";
    case "review": return "reviewer.md";
    default: return undefined;
  }
}

async function loadRolePrompt(cwd: string, role: TakomiRole): Promise<string> {
  const fileName = agentFileNameForRole(role);
  if (!fileName) return fallbackRolePrompt(role);

  const candidates = [
    path.join(cwd, ".pi", "agents", fileName),
    path.join(installedAssetRoot("agents"), fileName),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      const cleaned = stripPromptFrontmatter(raw);
      if (cleaned) {
        return [
          fallbackRolePrompt(role),
          `Canonical Takomi role mirror loaded from ${candidate}:`,
          cleaned,
        ].join("\n\n");
      }
    } catch { }
  }

  return fallbackRolePrompt(role);
}

function planPrompt(): string {
  return [
    "Takomi planning mode is active.",
    "Before major implementation, produce a short numbered plan.",
    "If the request is broad, explicitly identify whether the user is in genesis, design, or build.",
  ].join("\n");
}

function stripPromptFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function stripTemplateOnlyRequestPlaceholder(content: string): string {
  return content
    .replace(/\n?---\s*\r?\n\s*## Current User Request\s*\r?\n\s*(?:\$@|\$ARGUMENTS)\s*$/i, "")
    .replace(/\n?## Current User Request\s*\r?\n\s*(?:\$@|\$ARGUMENTS)\s*$/i, "")
    .trim();
}

function installedAssetRoot(kind: "agents" | "prompts"): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    kind,
  );
}

async function loadWorkflowPrompt(cwd: string, workflow: TakomiWorkflowId): Promise<string | undefined> {
  const fileName = workflow === "vibe-genesis"
    ? "genesis-prompt.md"
    : workflow === "vibe-design"
      ? "design-prompt.md"
      : "build-prompt.md";
  const candidates = [
    path.join(cwd, ".pi", "prompts", fileName),
    path.join(installedAssetRoot("prompts"), fileName),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      const cleaned = stripTemplateOnlyRequestPlaceholder(stripPromptFrontmatter(raw));
      if (cleaned) return cleaned;
    } catch { }
  }

  return undefined;
}

async function getInjectedPlaybook(cwd: string, state: TakomiState, includeFullWorkflow: boolean): Promise<string | undefined> {
  if (!state.workflow) return undefined;
  const workflow = getWorkflowDefinition(state.workflow);
  const prompt = includeFullWorkflow ? await loadWorkflowPrompt(cwd, state.workflow) : undefined;

  if (includeFullWorkflow) {
    return [
      `Active Takomi workflow: ${workflow.title} (${workflow.id}).`,
      prompt ?? workflow.playbook,
      workflow.nextStage ? `After this stage, recommend ${workflow.nextStage}.` : "",
    ].filter(Boolean).join("\n\n");
  }

  return [
    `Active Takomi workflow: ${workflow.title} (${workflow.id}).`,
    workflow.purpose,
    workflow.preferredModelHint ?? "",
    `Compact reminder: follow the ${workflow.id} stage. Full workflow was injected when this role/workflow became active; reload the markdown prompt only if behavior degrades or the task is complex.`,
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
  return tasks.map((task) => `${task.id}: ${task.stage ?? "-"} | ${task.title} [${task.status}] -> ${task.preferredAgent ?? task.role}${task.conversationId ? ` (${task.conversationId})` : ""}${task.workflow ? ` | workflow=${task.workflow}` : ""}${task.preferredModel ? ` | model=${task.preferredModel}` : ""}${task.preferredThinking ? ` | thinking=${task.preferredThinking}` : ""}${task.dispatchPolicy ? ` | execution=${task.dispatchPolicy}` : ""}${task.skills?.length ? ` | skills=${task.skills.join(",")}` : ""}`).join("\n");
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

function repairTaskMarkdown(content: string): string {
  return content
    .replace(/### Required Skills/g, "### Optional Skill / Context Overlays")
    .replace(/Required Skills/g, "Optional Skill / Context Overlays")
    .replace(/Load ALL required skills/g, "Use relevant optional skill/context overlays only when available and genuinely helpful")
    .replace(/Required skills/g, "Optional skill/context overlays")
    .replace(/required skills/g, "optional skill/context overlays");
}

async function findExistingTaskFile(paths: ReturnType<typeof getSessionPaths>, task: OrchestratorTask): Promise<string | undefined> {
  for (const folder of [paths.pending, paths.inProgress, paths.completed, paths.blocked]) {
    const entries = await readdir(folder).catch(() => [] as string[]);
    const match = entries.find((entry) => entry.endsWith(".task.md") && entry.startsWith(`${task.id}_`));
    if (match) return path.join(folder, match);
  }
  return undefined;
}

async function writeTaskArtifact(paths: ReturnType<typeof getSessionPaths>, state: OrchestratorSessionState, task: OrchestratorTask) {
  const targetPath = path.join(getTaskFolder(paths, task.status), getTaskFileName(task));
  const existingPath = await findExistingTaskFile(paths, task);
  if (!existingPath) {
    await writeFile(targetPath, renderTaskFile(task, `Parent session: ${state.sessionId}\n\nTask title: ${task.title}`), "utf8");
    return;
  }

  const existing = repairTaskMarkdown(await readFile(existingPath, "utf8"));
  await writeFile(targetPath, existing, "utf8");
  if (existingPath !== targetPath) await rm(existingPath, { force: true });
}

async function syncTaskArtifacts(cwd: string, session: OrchestratorSessionState) {
  const normalizedState = normalizeSessionState(session);
  const paths = getSessionPaths(cwd, normalizedState.sessionId);
  await mkdir(paths.pending, { recursive: true });
  await mkdir(paths.inProgress, { recursive: true });
  await mkdir(paths.completed, { recursive: true });
  await mkdir(paths.blocked, { recursive: true });
  await mkdir(paths.stateDir, { recursive: true });
  const existingMasterPlan = await readFile(paths.masterPlan, "utf8").catch(() => "");
  if (!existingMasterPlan || existingMasterPlan.includes("takomi-generated-master-plan")) {
    await writeFile(paths.masterPlan, renderMasterPlan(normalizedState), "utf8");
  }
  const validation = validateSessionState(normalizedState);
  await writeFile(paths.summary, [
    `# Orchestrator Summary: ${normalizedState.title}`,
    "",
    `- Session ID: ${normalizedState.sessionId}`,
    `- Human docs: ${paths.root}`,
    `- Machine state: ${paths.stateFile}`,
    `- Runtime mode: ${normalizedState.mode}`,
    `- Session intent: ${normalizedState.sessionIntent ?? "full-project"}`,
    `- Validation: ${validation.ok ? "PASS" : "ERRORS"} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`,
    "",
    "## Validation",
    "",
    renderValidationReport(validation),
  ].join("\n"), "utf8");
  await writeFile(paths.stateFile, serializeSessionState(normalizedState), "utf8");

  for (const task of normalizedState.tasks) {
    await writeTaskArtifact(paths, normalizedState, task);
  }

  return paths;
}

async function writeOrchestratorSession(cwd: string, session: OrchestratorSessionState) {
  return syncTaskArtifacts(cwd, session);
}

type IncomingTask = {
  id?: string;
  title: string;
  taskMarkdown?: string;
  status?: OrchestratorTaskStatus;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  parentTaskId?: string;
  preferredAgent?: string;
  preferredModel?: string;
  preferredModelHint?: string;
  preferredThinking?: TakomiThinkingLevel;
  fallbackModels?: string[];
  executionHint?: TakomiDispatchPolicy;
  dispatchPolicy?: TakomiDispatchPolicy;
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
    const stage = task.stage ?? stageOverride;
    const defaults = getProfileDefaults(activeProfile, task.role, stage);
    const fallbackModels = [
      ...(task.fallbackModels ?? []),
      ...(defaults.fallbackModels ?? []),
    ];
    const requestedModel = task.preferredModel ?? defaults.model;
    const resolvedModel = await resolvePreferredModel(ctx, requestedModel, fallbackModels);
    const id = task.id ?? getNextTaskId(nextTasks);
    nextTasks.push(createTask(id, task.title, task.role, {
      stage,
      workflow: task.workflow,
      parentTaskId: task.parentTaskId,
      preferredAgent: task.preferredAgent ?? defaults.agent,
      preferredModel: resolvedModel.model,
      preferredModelHint: [task.preferredModelHint, resolvedModel.warning].filter(Boolean).join(" ").trim() || undefined,
      preferredThinking: task.preferredThinking ?? defaults.thinking,
      fallbackModels: fallbackModels.length ? fallbackModels : undefined,
      status: task.status ?? "pending",
      dispatchPolicy: task.executionHint ?? task.dispatchPolicy ?? defaults.dispatchPolicy,
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

async function applyProfileDefaultsToTasks(ctx: ExtensionContext, tasks: OrchestratorTask[]): Promise<OrchestratorTask[]> {
  const nextTasks: OrchestratorTask[] = [];
  for (const task of tasks) {
    const defaults = getProfileDefaults(activeProfile, task.role, task.stage);
    const fallbackModels = [
      ...(task.fallbackModels ?? []),
      ...(defaults.fallbackModels ?? []),
    ];
    const requestedModel = task.preferredModel ?? defaults.model;
    const resolvedModel = await resolvePreferredModel(ctx, requestedModel, fallbackModels);
    nextTasks.push({
      ...task,
      preferredAgent: task.preferredAgent ?? defaults.agent,
      preferredModel: resolvedModel.model,
      preferredModelHint: [task.preferredModelHint, resolvedModel.warning].filter(Boolean).join(" ").trim() || undefined,
      preferredThinking: task.preferredThinking ?? defaults.thinking,
      fallbackModels: fallbackModels.length ? fallbackModels : undefined,
      dispatchPolicy: task.dispatchPolicy ?? defaults.dispatchPolicy,
    });
  }
  return nextTasks;
}

function installTakomiFooter(ctx: ExtensionContext, stateRef: { current: TakomiState }): void {
  ctx.ui.setFooter((tui, theme, footerData) => new TakomiFooterComponent(tui, theme, footerData, ctx, () => stateRef.current));
}

// Mutable state ref so the footer closure always reads the latest state
const footerStateRef: { current: TakomiState; installed: boolean } = { current: cloneState(DEFAULT_STATE), installed: false };

async function refreshUi(ctx: ExtensionContext, state: TakomiState) {
  if (!ctx.hasUI) return;
  ctx.ui.setTitle("Takomi");
  ctx.ui.setHeader((_tui, theme) => ({
    invalidate() { },
    render() {
      return renderTakomiHeader(theme);
    },
  }));
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
      launchMode: state.launchMode,
      planMode: state.planMode,
      activeSubagent: activeSubagentLabel,
    });
  }

  async function applySubagentRuntimeEvent(event: TakomiSubagentRuntimeEvent, ctx: ExtensionContext): Promise<void> {
    if (event.type === "start") {
      activeSubagentLabel = `${event.state.agent}: ${event.state.taskLabel}`;
      syncContextPanelState();
    } else if ((event.type === "update" || event.type === "complete" || event.type === "block") && event.patch) {
      const model = event.patch.model ? ` @ ${event.patch.model}` : "";
      const thinking = event.patch.thinking ? ` (${event.patch.thinking})` : "";
      const label = event.patch.summary?.split(/\r?\n/).find(Boolean);
      if (label) activeSubagentLabel = `${label}${model}${thinking}`;
      syncContextPanelState();
    }
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

  registerTakomiCommands(pi, {
    getState: () => state,
    updateState,
    setStageAndWorkflow: (stage, options) => setStageAndWorkflow(state, stage, options),
    hasGenesisArtifacts,
    subagentController,
    createPlanSession: async (ctx, title) => {
      const starter = createLifecycleStarterSession(title?.trim() || "Takomi Project");
      const session = buildSessionState(
        starter.sessionId,
        starter.title,
        await applyProfileDefaultsToTasks(ctx, starter.tasks),
        new Date(),
        { sessionIntent: starter.sessionIntent, lifecycle: starter.lifecycle },
      );
      const paths = await writeOrchestratorSession(ctx.cwd, session);
      await updateState(ctx, () => {
        state.enabled = true;
        state.autoOrch = true;
        state.planMode = true;
        state.activeSessionId = session.sessionId;
        state.stage = "genesis";
        state.workflow = "vibe-genesis";
        state.role = "orchestrator";
      });
      return `Takomi plan created session ${session.sessionId}\nMaster plan: ${paths.masterPlan}`;
    },
    resetRuntime: async (ctx) => {
      await updateState(ctx, () => {
        state = cloneState(DEFAULT_STATE);
        activeSubagentLabel = undefined;
      }, "Takomi runtime state reset");
      subagentController.reset(ctx);
      contextPanel.resetSession();
      contextPanel.show(ctx);
    },
  });

  pi.registerShortcut("alt+t", {
    description: "Toggle native tool result expansion",
    handler: async (ctx) => {
      const expanded = !ctx.ui.getToolsExpanded();
      ctx.ui.setToolsExpanded(expanded);
      ctx.ui.notify(`${expanded ? "Expanded" : "Collapsed"} native tool results.`, "info");
    },
  });

  pi.registerShortcut("alt+shift+t", {
    description: "Expand native tool results",
    handler: async (ctx) => {
      ctx.ui.setToolsExpanded(true);
      ctx.ui.notify("Expanded native tool results for Takomi subagent output.", "info");
    },
  });

  pi.registerShortcut("alt+n", {
    description: "Show native subagent navigation hint",
    handler: async (ctx) => {
      ctx.ui.notify("Native subagent results are shown inline by Pi; use the transcript/tool expansion instead of Takomi focus cycling.", "info");
    },
  });

  pi.registerShortcut("alt+p", {
    description: "Show native subagent navigation hint",
    handler: async (ctx) => {
      ctx.ui.notify("Native subagent results are shown inline by Pi; use the transcript/tool expansion instead of Takomi focus cycling.", "info");
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
    promptSnippet: "Register or update Takomi session/state/markdown artifacts; subagent execution happens elsewhere.",
    promptGuidelines: [
      "Use this when you need a concrete orchestrator session directory and task artifacts on disk.",
      "takomi_board never runs subagents. Author the human-facing markdown first, use takomi_subagent for execution, then return here with takomi_board update_task to record the outcome.",
      "Session IDs must use the canonical timestamp format orch-YYYYMMDD-HHMMSS. Use the same sessionId for the authored docs folder and the board JSON state.",
      "For high-quality orchestration sessions, provide sessionId, masterPlanMarkdown, and taskMarkdown values that match the authored session folder. If you already wrote docs/tasks/orchestrator-sessions/<id>, call this tool with sessionId=<id>; do not create a second session id.",
      "JSON fields should carry IDs/status/roles/workflow/dependencies/checklists for tracking, not replace expressive markdown.",
      "A new session should normally begin Genesis-first, then expand Design and Build into as many tasks as the scope actually needs.",
      "If the request is small enough, do not force orchestration just because the tool exists.",
      "If a reviewed task needs more work, reuse the task conversationId when you call takomi_subagent again, then update the board with the new result.",
    ],
    parameters: Type.Object({
      action: StringEnum(["init_session", "expand_stage", "show_workflows", "show_session", "update_task"] as const),
      title: Type.Optional(Type.String()),
      sessionId: Type.Optional(Type.String()),
      taskId: Type.Optional(Type.String()),
      stage: Type.Optional(StringEnum(["genesis", "design", "build"] as const)),
      status: Type.Optional(StringEnum(["pending", "in-progress", "completed", "blocked"] as const)),
      notes: Type.Optional(Type.String()),
      checklist: Type.Optional(Type.Array(Type.Union([
        Type.String(),
        Type.Object({ text: Type.String(), done: Type.Optional(Type.Boolean()) }),
      ]))),
      checklistUpdates: Type.Optional(Type.Array(Type.Object({
        text: Type.Optional(Type.String()),
        index: Type.Optional(Type.Number()),
        done: Type.Optional(Type.Boolean()),
      }))),
      masterPlanMarkdown: Type.Optional(Type.String()),
      tasks: Type.Optional(Type.Array(Type.Object({
        id: Type.Optional(Type.String()),
        title: Type.String(),
        taskMarkdown: Type.Optional(Type.String()),
        status: Type.Optional(StringEnum(["pending", "in-progress", "completed", "blocked"] as const)),
        role: StringEnum(["general", "orchestrator", "architect", "design", "code", "review"] as const),
        stage: Type.Optional(StringEnum(["genesis", "design", "build"] as const)),
        workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
        parentTaskId: Type.Optional(Type.String()),
        preferredAgent: Type.Optional(Type.String()),
        preferredModel: Type.Optional(Type.String()),
        preferredModelHint: Type.Optional(Type.String()),
        preferredThinking: Type.Optional(ThinkingSchema),
        fallbackModels: Type.Optional(Type.Array(Type.String())),
        executionHint: Type.Optional(StringEnum(["direct", "subagent", "review-first"] as const)),
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
          content: [{
            type: "text", text: `${masterPlan}\n\n---\n\nMachine state\n\n\
${stateJson}`
          }],
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
        if (params.masterPlanMarkdown?.trim()) {
          await writeFile(paths.masterPlan, params.masterPlanMarkdown.trimEnd() + "\n", "utf8");
        }
        for (const task of nextState.tasks) {
          const authored = (params.tasks as IncomingTask[] | undefined)?.find((input) => (input.id ?? task.id) === task.id)?.taskMarkdown;
          if (authored?.trim()) {
            await writeFile(path.join(getTaskFolder(paths, task.status), getTaskFileName(task)), authored.trimEnd() + "\n", "utf8");
          }
        }
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
        : await applyProfileDefaultsToTasks(ctx, baseState.tasks);
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
      if (params.masterPlanMarkdown?.trim()) {
        await writeFile(paths.masterPlan, params.masterPlanMarkdown.trimEnd() + "\n", "utf8");
      }
      for (const task of nextState.tasks) {
        const authored = (params.tasks as IncomingTask[] | undefined)?.find((input) => (input.id ?? task.id) === task.id)?.taskMarkdown;
        if (authored?.trim()) {
          await writeFile(path.join(getTaskFolder(paths, task.status), getTaskFileName(task)), authored.trimEnd() + "\n", "utf8");
        }
      }
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

    const routingUpdateMatch = text.match(/^update\s+(?:takomi\s+|our\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?\s*([\s\S]*)$/i)
      ?? text.match(/^set\s+(?:takomi\s+|our\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?\s*([\s\S]*)$/i);
    if (routingUpdateMatch) {
      state.enabled = true;
      try {
        const result = await installTakomiRoutingPolicy(runtimeCtx?.cwd ?? process.cwd(), text);
        const detected = result.detectedDefaults.length ? `\n\nDetected defaults:\n- ${result.detectedDefaults.join("\n- ")}` : "\n\nNo model names were auto-detected; saved policy only.";
        return { action: "transform", text: `Takomi routing policy has been updated.\n\nPolicy: ${result.policyPath}\nSettings: ${result.settingsPath}${detected}\n\nAcknowledge the update briefly and explain that future Takomi turns will load this policy.` };
      } catch (error) {
        return { action: "transform", text: `Takomi routing policy update failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

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

    const promptKey = `${effectiveState.role}:${effectiveState.workflow ?? "none"}`;
    const includeFullWorkflow = Boolean(effectiveState.workflow && effectiveState.lastFullPromptKey !== promptKey);
    if (includeFullWorkflow) {
      state.lastFullPromptKey = promptKey;
      persistState();
      syncContextPanelState();
    }

    const routingPolicy = await resolveTakomiRoutingPolicy(runtimeCwd);
    const modelPreflightContext = (() => {
      try {
        const available = typeof (runtimeCtx as { modelRegistry?: { getAvailable?: () => Array<{ provider?: string; id?: string; name?: string }> } } | undefined)?.modelRegistry?.getAvailable === "function"
          ? (runtimeCtx as { modelRegistry: { getAvailable: () => Array<{ provider?: string; id?: string; name?: string }> } }).modelRegistry.getAvailable()
          : [];
        if (!available.length) return "";
        return `Available model context from Pi registry: ${available.map((m) => `${m.provider ? `${m.provider}/` : ""}${m.id ?? m.name ?? "unknown"}`).slice(0, 80).join(", ")}`;
      } catch {
        return "";
      }
    })();

    const parts = [
      "Takomi runtime is active for this turn.",
      await loadRolePrompt(runtimeCwd, effectiveState.role),
      effectiveState.planMode ? planPrompt() : "",
      await getInjectedPlaybook(runtimeCwd, effectiveState, includeFullWorkflow),
      `Routing note: ${routingNote}`,
      routingPolicy.text
        ? `${routingPolicy.source === "bundled" ? "Bundled" : "Project"} Takomi model routing policy is active. Apply it when choosing parent/subagent models and escalation levels:\n\n${routingPolicy.text}`
        : "No Takomi routing policy file was found. Users can install one with `/takomi routing <policy>` or by saying `Update Takomi routing logic: \"\"\"...\"\"\"`.",
      modelPreflightContext,
      `Execution mode: ${route.executionMode}. Session recommendation: ${route.sessionRecommendation}.`,
      `Takomi execution gate: ${effectiveState.launchMode === "manual" ? "review" : "auto"}. In review gate mode, show the delegation plan before launching and return to the user after each task with results, verification guidance, and the recommended next step.`,
      !effectiveState.subagentsEnabled ? "Takomi subagents are disabled for this session. Do not call takomi_subagent or subagent until the user enables subagents." : "",
      !genesisExists ? "Project foundation is missing or incomplete. Do not skip Genesis unless the user explicitly waives it." : "",
      "Takomi is the default orchestration mindset here. Do not wait for the literal phrase 'use Takomi' before applying lifecycle judgment.",
      "Task fan-out is flexible. Do not force exactly three tasks; decompose Genesis, Design, and Build work to fit the actual scope.",
      "A new orchestration session should usually begin with one Genesis foundation task that creates or updates the required markdown artifacts, then expand later stages only when the scope justifies it.",
      "If a follow-up request is small, one-shot it. If it is multi-part or large, create or expand an orchestration session instead of pretending it is a single task.",
      "Before any Takomi subagent dispatch or model override, use the injected Pi model-registry context and project routing policy. Prefer provider-qualified model IDs. Do not run `pi --list-models` unless the registry context is missing or the user asks for a visible diagnostic.",
      "When useful, state the current Takomi stage and the recommended next stage.",
      effectiveState.stage === "build"
        ? "For build orchestration, use takomi_subagent to dispatch work to specialist subagents, then record the result on takomi_board; reuse the same conversation id when sending fixes back to the agent."
        : "",
    ].filter(Boolean);

    return {
      systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    runtimeCtx = ctx;
    activeProfile = await loadTakomiProfile(ctx.cwd);
    activeSubagentLabel = undefined;
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
    if (!entries.some((entry) => {
      const item = entry as { type: string; customType?: string };
      return item.type === "custom" && item.customType === STATE_ENTRY;
    })) {
      state.autoOrch = activeProfile.autoOrchestrate;
      state.launchMode = activeProfile.launchMode ?? (activeProfile.autoOrchestrate ? "auto" : "manual");
    } else {
      state.launchMode = state.launchMode ?? activeProfile.launchMode ?? "auto";
    }

    syncContextPanelState();
    await refreshUi(ctx, state);
    contextPanel.show(ctx);
    flushPendingSubagentEvents();
  });
}

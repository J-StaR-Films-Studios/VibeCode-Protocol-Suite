import path from "node:path";
import type {
  LifecycleStageState,
  OrchestratorSessionState,
  OrchestratorTask,
  OrchestratorTaskStatus,
  SessionIntent,
  TakomiRole,
  TaskChecklistItem,
  VibeLifecycleStage,
} from "./types";

export function createSessionId(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `orch-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function slugifyTaskTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function getSessionPaths(cwd: string, sessionId: string) {
  const docsRoot = path.join(cwd, "docs", "tasks", "orchestrator-sessions", sessionId);
  const machineRoot = path.join(cwd, ".pi", "takomi", "orchestrator");
  return {
    root: docsRoot,
    pending: path.join(docsRoot, "pending"),
    inProgress: path.join(docsRoot, "in-progress"),
    completed: path.join(docsRoot, "completed"),
    blocked: path.join(docsRoot, "blocked"),
    masterPlan: path.join(docsRoot, "master_plan.md"),
    summary: path.join(docsRoot, "Orchestrator_Summary.md"),
    stateDir: machineRoot,
    stateFile: path.join(machineRoot, `${sessionId}.json`),
  };
}

export function createConversationId(agent: string, taskId: string): string {
  return `${agent}-${taskId}`;
}

export function workflowToStage(workflow?: OrchestratorTask["workflow"]): VibeLifecycleStage | undefined {
  switch (workflow) {
    case "vibe-genesis":
      return "genesis";
    case "vibe-design":
      return "design";
    case "vibe-build":
      return "build";
    default:
      return undefined;
  }
}

function defaultStageForRole(role: TakomiRole): VibeLifecycleStage | undefined {
  switch (role) {
    case "architect":
      return "genesis";
    case "design":
      return "design";
    case "code":
    case "review":
    case "orchestrator":
      return "build";
    default:
      return undefined;
  }
}

function emptyStageState(): LifecycleStageState {
  return {
    status: "pending",
    taskIds: [],
    canExpand: true,
  };
}

export function createEmptyLifecycle(): Record<VibeLifecycleStage, LifecycleStageState> {
  return {
    genesis: emptyStageState(),
    design: emptyStageState(),
    build: emptyStageState(),
  };
}

function stageStatusFromTasks(tasks: OrchestratorTask[]): OrchestratorTaskStatus {
  if (!tasks.length) return "pending";
  if (tasks.every((task) => task.status === "completed")) return "completed";
  if (tasks.some((task) => task.status === "in-progress")) return "in-progress";
  if (tasks.some((task) => task.status === "blocked") && !tasks.some((task) => task.status === "completed")) return "blocked";
  if (tasks.some((task) => task.status === "completed")) return "in-progress";
  return "pending";
}

export function deriveLifecycleFromTasks(
  tasks: OrchestratorTask[],
  previous?: Partial<Record<VibeLifecycleStage, LifecycleStageState>>,
): Record<VibeLifecycleStage, LifecycleStageState> {
  const lifecycle = createEmptyLifecycle();

  for (const stage of Object.keys(lifecycle) as VibeLifecycleStage[]) {
    const stageTasks = tasks.filter((task) => task.stage === stage || workflowToStage(task.workflow) === stage);
    const prev = previous?.[stage];
    lifecycle[stage] = {
      status: stageStatusFromTasks(stageTasks),
      taskIds: stageTasks.map((task) => task.id),
      canExpand: prev?.canExpand ?? true,
      expandedAt: prev?.expandedAt,
      notes: prev?.notes,
    };
  }

  return lifecycle;
}

export function normalizeChecklist(checklist?: Array<string | TaskChecklistItem>): TaskChecklistItem[] | undefined {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

export function createTask(id: string, title: string, role: TakomiRole, extras?: Partial<OrchestratorTask>): OrchestratorTask {
  const preferredAgent = extras?.preferredAgent ?? (role === "design" ? "designer" : role === "architect" ? "architect" : role === "review" ? "reviewer" : role === "code" ? "coder" : "orchestrator");
  const stage = extras?.stage ?? workflowToStage(extras?.workflow) ?? defaultStageForRole(role);
  return {
    id,
    title,
    role,
    status: "pending",
    ...extras,
    stage,
    preferredAgent,
    conversationId: extras?.conversationId ?? createConversationId(preferredAgent, id),
    preferredModel: extras?.preferredModel,
    preferredModelHint: extras?.preferredModelHint,
    preferredThinking: extras?.preferredThinking,
    fallbackModels: extras?.fallbackModels,
    dispatchPolicy: extras?.dispatchPolicy,
    skills: extras?.skills,
    checklist: normalizeChecklist(extras?.checklist),
  };
}

export function getNextTaskId(tasks: OrchestratorTask[]): string {
  const max = tasks.reduce((current, task) => {
    const parsed = Number.parseInt(task.id, 10);
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  return String(max + 1).padStart(2, "0");
}

export function moveTaskStatus(tasks: OrchestratorTask[], id: string, status: OrchestratorTaskStatus): OrchestratorTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, status } : task));
}

function renderChecklist(checklist?: TaskChecklistItem[]): string[] {
  if (!checklist?.length) return ["- No checklist yet."];
  return checklist.map((item) => `- [${item.done ? "x" : " "}] ${item.text}`);
}

function renderBullets(items?: string[], empty = "- None specified."): string[] {
  if (!items?.length) return [empty];
  return items.map((item) => `- ${item}`);
}

function renderLifecycleSummary(state: OrchestratorSessionState): string[] {
  return (Object.keys(state.lifecycle) as VibeLifecycleStage[]).flatMap((stage) => {
    const entry = state.lifecycle[stage];
    const taskSummary = entry.taskIds.length ? entry.taskIds.join(", ") : "none yet";
    return [
      `### ${stage[0].toUpperCase()}${stage.slice(1)}`,
      `- Status: ${entry.status}`,
      `- Tasks: ${taskSummary}`,
      `- Expandable: ${entry.canExpand === false ? "no" : "yes"}`,
      entry.expandedAt ? `- Expanded At: ${entry.expandedAt}` : "",
      entry.notes ? `- Notes: ${entry.notes}` : "",
      "",
    ].filter(Boolean);
  });
}

export function renderMasterPlan(sessionOrId: OrchestratorSessionState | string, title?: string, tasks?: OrchestratorTask[]): string {
  const state = typeof sessionOrId === "string"
    ? buildSessionState(sessionOrId, title ?? "Takomi Session", tasks ?? [])
    : normalizeSessionState(sessionOrId);

  const rows = state.tasks
    .map((task) => `| ${task.id} | ${task.stage ?? "-"} | ${task.title} | ${task.status} | ${task.role} | ${task.preferredAgent ?? "-"} | ${task.workflow ?? "-"} | ${task.preferredModel ?? task.preferredModelHint ?? "-"} | ${task.preferredThinking ?? "-"} | ${task.dispatchPolicy ?? "-"} | ${task.skills?.join(", ") ?? "-"} |`)
    .join("\n");

  return [
    `# Master Plan: ${state.title}`,
    "",
    `**Session ID:** ${state.sessionId}`,
    `**Runtime Mode:** ${state.mode}`,
    `**Session Intent:** ${state.sessionIntent ?? "full-project"}`,
    "",
    "## Lifecycle",
    "",
    ...renderLifecycleSummary(state),
    "## Tasks",
    "",
    "| ID | Stage | Title | Status | Role | Preferred Agent | Workflow | Model | Thinking | Dispatch | Skills |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    rows || "| - | - | No tasks yet | - | - | - | - | - | - | - | - |",
    "",
    "## Notes",
    "",
    "- Human-readable task docs live in this session folder.",
    "- Machine state lives in `.pi/takomi/orchestrator/<sessionId>.json`.",
    "- Sending a task back to the same agent should reuse its conversationId when continuity is helpful.",
    "- Sessions follow the Genesis -> Design -> Build lifecycle, but each stage may stay compact or expand into more tasks.",
  ].join("\n");
}

export function renderTaskFile(task: OrchestratorTask, context?: string): string {
  return [
    `# Task: ${task.title}`,
    "",
    `**Task ID:** ${task.id}`,
    `**Stage:** ${task.stage ?? "-"}`,
    `**Status:** ${task.status}`,
    `**Role:** ${task.role}`,
    task.parentTaskId ? `**Parent Task:** ${task.parentTaskId}` : "",
    `**Preferred Agent:** ${task.preferredAgent ?? "-"}`,
    `**Conversation ID:** ${task.conversationId ?? "-"}`,
    `**Workflow:** ${task.workflow ?? "-"}`,
    task.preferredModel ? `**Model Override:** ${task.preferredModel}` : "",
    task.preferredModelHint ? `**Model Hint:** ${task.preferredModelHint}` : "",
    task.fallbackModels?.length ? `**Fallback Models:** ${task.fallbackModels.join(", ")}` : "",
    task.preferredThinking ? `**Thinking Level:** ${task.preferredThinking}` : "",
    task.dispatchPolicy ? `**Dispatch Policy:** ${task.dispatchPolicy}` : "",
    task.skills?.length ? `**Required Skills:** ${task.skills.join(", ")}` : "",
    "",
    "## Context",
    "",
    context ?? "Add task-specific context here.",
    "",
    "## Objective",
    "",
    task.objective ?? task.title,
    "",
    "## Scope",
    "",
    ...renderBullets(task.scope),
    "",
    "## Checklist",
    "",
    ...renderChecklist(task.checklist),
    "",
    "## Definition of Done",
    "",
    ...renderBullets(task.definitionOfDone),
    "",
    "## Expected Artifacts",
    "",
    ...renderBullets(task.expectedArtifacts),
    "",
    "## Dependencies",
    "",
    ...renderBullets(task.dependencies),
    "",
    "## Review Checkpoint",
    "",
    task.reviewCheckpoint ?? "Review before implementation handoff or final completion.",
    "",
    "## Instructions",
    "",
    ...renderBullets(task.instructions ?? [
      "complete the task within scope",
      "use the listed workflow and skills when they are provided",
      "report blockers clearly",
      "if review sends this back, continue using the same conversation id when possible",
      "summarize what changed and what remains",
    ]),
    task.notes ? "" : "",
    task.notes ? "## Notes" : "",
    task.notes ? "" : "",
    task.notes ?? "",
  ].filter(Boolean).join("\n");
}

export function buildSessionState(
  sessionId: string,
  title: string,
  tasks: OrchestratorTask[],
  now = new Date(),
  extras?: Partial<Pick<OrchestratorSessionState, "sessionIntent" | "lifecycle">>,
): OrchestratorSessionState {
  const stamp = now.toISOString();
  const normalizedTasks = tasks.map((task) => ({ ...task, stage: task.stage ?? workflowToStage(task.workflow) ?? defaultStageForRole(task.role) }));
  return {
    sessionId,
    title,
    createdAt: stamp,
    updatedAt: stamp,
    mode: "hybrid",
    lifecycle: deriveLifecycleFromTasks(normalizedTasks, extras?.lifecycle),
    sessionIntent: extras?.sessionIntent ?? "full-project",
    tasks: normalizedTasks,
  };
}

export function normalizeSessionState(
  session: Partial<OrchestratorSessionState> & Pick<OrchestratorSessionState, "sessionId" | "title">,
): OrchestratorSessionState {
  const tasks = (session.tasks ?? []).map((task) => ({ ...task, stage: task.stage ?? workflowToStage(task.workflow) ?? defaultStageForRole(task.role) }));
  const normalized = buildSessionState(
    session.sessionId,
    session.title,
    tasks,
    session.updatedAt ? new Date(session.updatedAt) : new Date(),
    {
      sessionIntent: session.sessionIntent ?? "full-project",
      lifecycle: session.lifecycle,
    },
  );

  return {
    ...normalized,
    createdAt: session.createdAt ?? normalized.createdAt,
    updatedAt: session.updatedAt ?? normalized.updatedAt,
    mode: "hybrid",
  };
}

export function markStageExpanded(
  state: OrchestratorSessionState,
  stage: VibeLifecycleStage,
  notes?: string,
  now = new Date(),
): OrchestratorSessionState {
  const lifecycle = {
    ...state.lifecycle,
    [stage]: {
      ...state.lifecycle[stage],
      expandedAt: now.toISOString(),
      notes: notes ?? state.lifecycle[stage].notes,
    },
  };
  return normalizeSessionState({
    ...state,
    updatedAt: now.toISOString(),
    lifecycle,
  });
}

export function createLifecycleStarterSession(
  title: string,
  options?: { sessionId?: string; now?: Date; sessionIntent?: SessionIntent },
): OrchestratorSessionState {
  const sessionId = options?.sessionId ?? createSessionId(options?.now);
  const tasks = [
    createTask("01", "Genesis foundation", "orchestrator", {
      stage: "genesis",
      workflow: "vibe-genesis",
      preferredAgent: "orchestrator",
      objective: "Establish the project foundation, produce the required planning docs, and decide what should split next.",
      scope: [
        "Clarify scope and mission",
        "Create or update the core markdown artifacts",
        "Lock acceptance criteria and boundaries",
        "Recommend whether Design and Build should stay compact or expand",
      ],
      checklist: [
        { text: "Create or update requirements docs" },
        { text: "Capture acceptance criteria" },
        { text: "Define boundaries and non-goals" },
        { text: "Recommend next-stage task breakdown" },
      ],
      definitionOfDone: [
        "Required planning markdown files exist or are updated",
        "Minimum usable state is explicit",
        "Genesis recommends the correct next Design and Build structure",
      ],
      expectedArtifacts: [
        "Requirements and feature docs",
        "Genesis brief",
        "Recommended task breakdown for later stages",
      ],
      reviewCheckpoint: "User or orchestrator approves the foundation before expanding later stages.",
      instructions: [
        "treat this as the root task for the whole Genesis -> Design -> Build lifecycle",
        "create the required markdown artifacts before implementation begins",
        "split later-stage work only when the scope justifies it",
        "leave a clear recommendation for how Design and Build should fan out",
      ],
    }),
  ];

  return buildSessionState(sessionId, title, tasks, options?.now, {
    sessionIntent: options?.sessionIntent ?? "full-project",
  });
}

export function serializeSessionState(state: OrchestratorSessionState): string {
  return `${JSON.stringify(normalizeSessionState(state), null, 2)}\n`;
}

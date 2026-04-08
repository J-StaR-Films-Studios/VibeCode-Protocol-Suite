import path from "node:path";
import type {
  OrchestratorSessionState,
  OrchestratorTask,
  OrchestratorTaskStatus,
  TakomiRole,
  TaskChecklistItem,
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

export function normalizeChecklist(checklist?: Array<string | TaskChecklistItem>): TaskChecklistItem[] | undefined {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

export function createTask(id: string, title: string, role: TakomiRole, extras?: Partial<OrchestratorTask>): OrchestratorTask {
  const preferredAgent = extras?.preferredAgent ?? (role === "design" ? "designer" : role === "architect" ? "architect" : role === "review" ? "reviewer" : role === "code" ? "coder" : "orchestrator");
  return {
    id,
    title,
    role,
    status: "pending",
    ...extras,
    preferredAgent,
    conversationId: extras?.conversationId ?? createConversationId(preferredAgent, id),
    preferredModel: extras?.preferredModel,
    preferredModelHint: extras?.preferredModelHint,
    skills: extras?.skills,
    checklist: normalizeChecklist(extras?.checklist),
  };
}

export function moveTaskStatus(tasks: OrchestratorTask[], id: string, status: OrchestratorTaskStatus): OrchestratorTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, status } : task));
}

function renderChecklist(checklist?: TaskChecklistItem[]): string[] {
  if (!checklist?.length) return ["- No checklist yet."];
  return checklist.map((item) => `- [${item.done ? "x" : " "}] ${item.text}`);
}

export function renderMasterPlan(sessionId: string, title: string, tasks: OrchestratorTask[]): string {
  const rows = tasks
    .map((task) => `| ${task.id} | ${task.title} | ${task.status} | ${task.role} | ${task.preferredAgent ?? "-"} | ${task.workflow ?? "-"} | ${task.preferredModel ?? task.preferredModelHint ?? "-"} | ${task.skills?.join(", ") ?? "-"} |`)
    .join("\n");

  return [
    `# Master Plan: ${title}`,
    "",
    `**Session ID:** ${sessionId}`,
    `**Runtime Mode:** hybrid`,
    "",
    "## Tasks",
    "",
    "| ID | Title | Status | Role | Preferred Agent | Workflow | Model | Skills |",
    "|---|---|---|---|---|---|---|---|",
    rows || "| - | No tasks yet | - | - | - | - | - | - |",
    "",
    "## Notes",
    "",
    "- Human-readable task docs live in this session folder.",
    "- Machine state lives in `.pi/takomi/orchestrator/<sessionId>.json`.",
    "- Sending a task back to the same agent should reuse its conversationId when continuity is helpful.",
  ].join("\n");
}

export function renderTaskFile(task: OrchestratorTask, context?: string): string {
  return [
    `# Task: ${task.title}`,
    "",
    `**Task ID:** ${task.id}`,
    `**Status:** ${task.status}`,
    `**Role:** ${task.role}`,
    `**Preferred Agent:** ${task.preferredAgent ?? "-"}`,
    `**Conversation ID:** ${task.conversationId ?? "-"}`,
    `**Workflow:** ${task.workflow ?? "-"}`,
    task.preferredModel ? `**Model Override:** ${task.preferredModel}` : "",
    task.preferredModelHint ? `**Model Hint:** ${task.preferredModelHint}` : "",
    task.skills?.length ? `**Skills:** ${task.skills.join(", ")}` : "",
    "",
    "## Context",
    "",
    context ?? "Add task-specific context here.",
    "",
    "## Checklist",
    "",
    ...renderChecklist(task.checklist),
    "",
    "## Instructions",
    "",
    "- complete the task within scope",
    "- use the listed workflow and skills when they are provided",
    "- report blockers clearly",
    "- if review sends this back, continue using the same conversation id when possible",
    "- summarize what changed and what remains",
  ].filter(Boolean).join("\n");
}

export function buildSessionState(sessionId: string, title: string, tasks: OrchestratorTask[], now = new Date()): OrchestratorSessionState {
  const stamp = now.toISOString();
  return {
    sessionId,
    title,
    createdAt: stamp,
    updatedAt: stamp,
    mode: "hybrid",
    tasks,
  };
}

export function serializeSessionState(state: OrchestratorSessionState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

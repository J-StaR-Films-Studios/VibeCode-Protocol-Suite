import path from "node:path";
import type { OrchestratorTask, OrchestratorTaskStatus, TakomiRole } from "./types";

export function createSessionId(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `orch-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function getSessionPaths(cwd: string, sessionId: string) {
  const root = path.join(cwd, "docs", "tasks", "orchestrator-sessions", sessionId);
  return {
    root,
    pending: path.join(root, "pending"),
    inProgress: path.join(root, "in-progress"),
    completed: path.join(root, "completed"),
    masterPlan: path.join(root, "master_plan.md"),
    summary: path.join(root, "Orchestrator_Summary.md"),
  };
}

export function createConversationId(agent: string, taskId: string): string {
  return `${agent}-${taskId}`;
}

export function createTask(id: string, title: string, role: TakomiRole, extras?: Partial<OrchestratorTask>): OrchestratorTask {
  const preferredAgent = extras?.preferredAgent ?? (role === "design" ? "designer" : role === "architect" ? "architect" : role === "review" ? "reviewer" : role === "code" ? "coder" : "orchestrator");
  return {
    id,
    title,
    role,
    status: "pending",
    preferredAgent,
    conversationId: createConversationId(preferredAgent, id),
    ...extras,
  };
}

export function moveTaskStatus(tasks: OrchestratorTask[], id: string, status: OrchestratorTaskStatus): OrchestratorTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, status } : task));
}

export function renderMasterPlan(sessionId: string, title: string, tasks: OrchestratorTask[]): string {
  const rows = tasks
    .map((task) => `| ${task.id} | ${task.title} | ${task.status} | ${task.role} | ${task.preferredAgent ?? "-"} | ${task.workflow ?? "-"} |`)
    .join("\n");

  return [
    `# Master Plan: ${title}`,
    "",
    `**Session ID:** ${sessionId}`,
    "",
    "## Tasks",
    "",
    "| ID | Title | Status | Role | Preferred Agent | Workflow |",
    "|---|---|---|---|---|---|",
    rows || "| - | No tasks yet | - | - | - | - |",
    "",
    "## Notes",
    "",
    "- Use the build orchestrator to dispatch, review, and re-dispatch tasks as needed.",
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
    task.preferredModelHint ? `**Model Hint:** ${task.preferredModelHint}` : "",
    "",
    "## Context",
    "",
    context ?? "Add task-specific context here.",
    "",
    "## Instructions",
    "",
    "- complete the task within scope",
    "- report blockers clearly",
    "- if review sends this back, continue using the same conversation id when possible",
    "- summarize what changed and what remains",
  ].filter(Boolean).join("\n");
}

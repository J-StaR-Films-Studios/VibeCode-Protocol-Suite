import type {
  OrchestratorSessionState,
  OrchestratorTask,
  OrchestratorTaskStatus,
  TakomiWorkflowId,
  VibeLifecycleStage,
} from "./types";
import { workflowToStage } from "./orchestration";

export type TakomiValidationSeverity = "error" | "warning" | "advisory";

export type TakomiValidationIssue = {
  severity: TakomiValidationSeverity;
  code: string;
  message: string;
  taskId?: string;
};

export type TakomiValidationReport = {
  ok: boolean;
  errors: TakomiValidationIssue[];
  warnings: TakomiValidationIssue[];
  advisories: TakomiValidationIssue[];
  issues: TakomiValidationIssue[];
};

const STAGES: VibeLifecycleStage[] = ["genesis", "design", "build"];
const STATUSES: OrchestratorTaskStatus[] = ["pending", "in-progress", "completed", "blocked"];
const LONG_PROSE_FIELDS: Array<keyof OrchestratorTask> = [
  "objective",
  "scope",
  "definitionOfDone",
  "expectedArtifacts",
  "reviewCheckpoint",
  "instructions",
  "notes",
];

function issue(severity: TakomiValidationSeverity, code: string, message: string, taskId?: string): TakomiValidationIssue {
  return { severity, code, message, taskId };
}

function hasLongProse(value: unknown): boolean {
  if (typeof value === "string") return value.length > 280;
  if (Array.isArray(value)) return value.some((item) => typeof item === "string" && item.length > 180) || value.length > 12;
  return false;
}

function taskWorkflowStageMismatch(task: OrchestratorTask): boolean {
  const workflowStage = workflowToStage(task.workflow as TakomiWorkflowId | undefined);
  return Boolean(task.stage && workflowStage && task.stage !== workflowStage);
}

function finish(issues: TakomiValidationIssue[]): TakomiValidationReport {
  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");
  const advisories = issues.filter((entry) => entry.severity === "advisory");
  return { ok: errors.length === 0, errors, warnings, advisories, issues };
}

export function validateSessionState(state: OrchestratorSessionState): TakomiValidationReport {
  const issues: TakomiValidationIssue[] = [];

  if (!/^orch-\d{8}-\d{6}/.test(state.sessionId)) {
    issues.push(issue("warning", "session-id-format", `Session ID does not match orch-YYYYMMDD-HHMMSS: ${state.sessionId}`));
  }
  if (!state.title?.trim()) issues.push(issue("error", "missing-title", "Session title is required."));
  if (state.mode !== "hybrid") issues.push(issue("error", "invalid-mode", `Unsupported session mode: ${String(state.mode)}`));
  if (!state.lifecycle) issues.push(issue("error", "missing-lifecycle", "Lifecycle state is required."));
  if (!Array.isArray(state.tasks)) issues.push(issue("error", "missing-tasks", "Session tasks must be an array."));

  const taskIds = new Set<string>();
  for (const task of state.tasks ?? []) {
    if (!task.id?.trim()) issues.push(issue("error", "missing-task-id", `Task is missing an ID: ${task.title || "(untitled)"}`));
    if (taskIds.has(task.id)) issues.push(issue("error", "duplicate-task-id", `Duplicate task ID: ${task.id}`, task.id));
    taskIds.add(task.id);

    if (!task.title?.trim()) issues.push(issue("error", "missing-task-title", "Task title is required.", task.id));
    if (!STATUSES.includes(task.status)) issues.push(issue("error", "invalid-task-status", `Invalid status: ${String(task.status)}`, task.id));
    if (taskWorkflowStageMismatch(task)) {
      issues.push(issue("error", "stage-workflow-mismatch", `Task stage ${task.stage} conflicts with workflow ${task.workflow}.`, task.id));
    }
    for (const dependency of task.dependencies ?? []) {
      if (!taskIds.has(dependency) && !(state.tasks ?? []).some((candidate) => candidate.id === dependency)) {
        issues.push(issue("error", "missing-dependency", `Task depends on missing task: ${dependency}`, task.id));
      }
    }
    if (task.status === "completed" && task.checklist?.some((item) => !item.done)) {
      issues.push(issue("error", "completed-task-incomplete-checklist", "Completed task has incomplete checklist items.", task.id));
    }
    for (const field of LONG_PROSE_FIELDS) {
      if (hasLongProse(task[field])) {
        issues.push(issue("warning", "json-prose-field", `Task JSON contains substantial prose in ${String(field)}; prefer authored markdown for long-form content.`, task.id));
      }
    }
    if (task.skills?.length && task.skills.length > 12) {
      issues.push(issue("warning", "too-many-skill-overlays", "Task lists more than 12 skill/context overlays.", task.id));
    }
  }

  for (const stage of STAGES) {
    const lifecycle = state.lifecycle?.[stage];
    if (!lifecycle) {
      issues.push(issue("error", "missing-stage", `Lifecycle stage is missing: ${stage}`));
      continue;
    }
    for (const taskId of lifecycle.taskIds ?? []) {
      if (!taskIds.has(taskId)) issues.push(issue("error", "lifecycle-missing-task", `Lifecycle stage ${stage} references missing task ${taskId}.`));
    }
    const stageTasks = state.tasks.filter((task) => task.stage === stage || workflowToStage(task.workflow) === stage);
    if (lifecycle.status === "completed" && stageTasks.some((task) => task.status !== "completed")) {
      issues.push(issue("error", "stage-completed-with-open-tasks", `Stage ${stage} is completed but contains non-completed tasks.`));
    }
    if (lifecycle.status === "in-progress" && !stageTasks.some((task) => task.status === "in-progress")) {
      issues.push(issue("warning", "stage-in-progress-without-task", `Stage ${stage} is in-progress but has no in-progress task.`));
    }
    if (lifecycle.status === "blocked" && !stageTasks.some((task) => task.status === "blocked")) {
      issues.push(issue("warning", "stage-blocked-without-task", `Stage ${stage} is blocked but has no blocked task.`));
    }
  }

  if (state.sessionIntent === "full-project" && state.tasks.length === 1) {
    issues.push(issue("warning", "broad-session-single-task", "Full-project session has one task; add a justification or decompose when scope is broad."));
  }

  return finish(issues);
}

export function renderValidationReport(report: TakomiValidationReport): string {
  if (report.issues.length === 0) return "Takomi session validation: PASS";
  return [
    `Takomi session validation: ${report.ok ? "WARNINGS" : "ERRORS"}`,
    ...report.issues.map((entry) => `- [${entry.severity.toUpperCase()}] ${entry.code}${entry.taskId ? ` (${entry.taskId})` : ""}: ${entry.message}`),
  ].join("\n");
}

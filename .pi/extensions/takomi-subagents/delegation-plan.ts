import type {
  TakomiDelegationPlan,
  TakomiDelegationPlanTask,
  TakomiDispatchPolicy,
  TakomiLaunchMode,
  TakomiProfile,
  TakomiRole,
  TakomiThinkingLevel,
  TakomiWorkflowId,
  VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import type { ChecklistInput } from "../takomi-runtime/shared";

type PlanTaskInput = {
  id?: string;
  title?: string;
  agent: string;
  task: string;
  role?: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId | string;
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  checklist?: ChecklistInput;
  dispatchPolicy?: TakomiDispatchPolicy;
  review?: boolean;
};

type PlanInput = {
  source: TakomiDelegationPlan["source"];
  sessionId?: string;
  launchMode: TakomiLaunchMode;
  profile: TakomiProfile;
  tasks: PlanTaskInput[];
};

function normalizeChecklist(checklist?: ChecklistInput): TakomiDelegationPlanTask["checklist"] {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

export function createTakomiDelegationPlan(input: PlanInput): TakomiDelegationPlan {
  const reviewAfterImplementation = input.profile.reviewAfterImplementation ?? input.profile.review?.enabled ?? true;
  return {
    planId: `takomi-plan-${Date.now()}`,
    source: input.source,
    launchMode: input.launchMode,
    placement: input.profile.background ? "background" : "foreground",
    reviewAfterImplementation,
    createdAt: new Date().toISOString(),
    sessionId: input.sessionId,
    tasks: input.tasks.map((task, index) => ({
      id: task.id ?? `plan-task-${index + 1}`,
      title: task.title ?? task.task.split(/\r?\n/).find(Boolean)?.slice(0, 80) ?? `Task ${index + 1}`,
      agent: task.agent,
      task: task.task,
      role: task.role,
      stage: task.stage,
      workflow: task.workflow,
      model: task.model,
      fallbackModels: task.fallbackModels,
      thinking: task.thinking,
      conversationId: task.conversationId,
      checklist: normalizeChecklist(task.checklist),
      dispatchPolicy: task.dispatchPolicy,
      review: task.review ?? reviewAfterImplementation,
      status: "planned",
    })),
  };
}

export function renderTakomiDelegationPlan(plan: TakomiDelegationPlan): string {
  const lines = [
    `Takomi delegation plan ${plan.planId}`,
    `mode=${plan.launchMode} | placement=${plan.placement} | reviewAfterImplementation=${plan.reviewAfterImplementation ? "on" : "off"}`,
  ];
  for (const task of plan.tasks) {
    const checklist = task.checklist?.length ? ` | checklist=${task.checklist.filter((item) => item.done).length}/${task.checklist.length}` : "";
    const fallback = task.fallbackModels?.length ? ` | fallbacks=${task.fallbackModels.length}` : "";
    lines.push([
      `${task.id}: ${task.agent}`,
      task.model ? `model=${task.model}` : "model=default",
      task.thinking ? `thinking=${task.thinking}` : "thinking=default",
      task.workflow ? `workflow=${task.workflow}` : "",
      task.review ? "review=on" : "review=off",
      `task=${task.title}${fallback}${checklist}`,
    ].filter(Boolean).join(" | "));
  }
  if (plan.launchMode === "manual") {
    lines.push("", "Manual launch mode: review or edit agent/task/model/thinking/review settings, then rerun with confirmLaunch=true. Use previewOnly=true to keep reviewing without launch.");
  }
  return lines.join("\n");
}

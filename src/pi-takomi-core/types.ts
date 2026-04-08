export type TakomiRole = "general" | "orchestrator" | "architect" | "design" | "code" | "review";

export type TakomiWorkflowId = "vibe-genesis" | "vibe-design" | "vibe-build";

export type VibeLifecycleStage = "genesis" | "design" | "build";

export type WorkflowDefinition = {
  id: TakomiWorkflowId;
  stage: VibeLifecycleStage;
  title: string;
  purpose: string;
  preferredRole: TakomiRole;
  preferredAgent?: string;
  preferredModelHint?: string;
  nextStage?: VibeLifecycleStage;
  playbook: string;
};

export type RouteDecision = {
  role: TakomiRole;
  workflow?: TakomiWorkflowId;
  stage?: VibeLifecycleStage;
  reason: string;
};

export type OrchestratorTaskStatus = "pending" | "in-progress" | "completed" | "blocked";

export type OrchestratorTask = {
  id: string;
  title: string;
  role: TakomiRole;
  workflow?: TakomiWorkflowId;
  preferredAgent?: string;
  preferredModelHint?: string;
  status: OrchestratorTaskStatus;
  notes?: string;
  conversationId?: string;
};

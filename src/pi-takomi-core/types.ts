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

export type TaskChecklistItem = {
  text: string;
  done?: boolean;
};

export type OrchestratorTask = {
  id: string;
  title: string;
  role: TakomiRole;
  workflow?: TakomiWorkflowId;
  preferredAgent?: string;
  preferredModelHint?: string;
  preferredModel?: string;
  skills?: string[];
  checklist?: TaskChecklistItem[];
  objective?: string;
  scope?: string[];
  definitionOfDone?: string[];
  expectedArtifacts?: string[];
  dependencies?: string[];
  reviewCheckpoint?: string;
  instructions?: string[];
  status: OrchestratorTaskStatus;
  notes?: string;
  conversationId?: string;
};

export type OrchestratorSessionState = {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: "hybrid";
  tasks: OrchestratorTask[];
};

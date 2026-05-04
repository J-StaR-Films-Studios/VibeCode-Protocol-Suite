export type TakomiRole = "general" | "orchestrator" | "architect" | "design" | "code" | "review";

export type TakomiWorkflowId = "vibe-genesis" | "vibe-design" | "vibe-build";

export type VibeLifecycleStage = "genesis" | "design" | "build";

export type TakomiThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type TakomiDispatchPolicy = "direct" | "subagent" | "review-first";

export type TakomiDispatchDefaults = {
  agent?: string;
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  dispatchPolicy?: TakomiDispatchPolicy;
};

export type TakomiReviewProfile = {
  enabled: boolean;
  agent?: string;
  maxIterations?: number;
  sameConversation: boolean;
};

export type TakomiProfile = {
  version: 1;
  autoOrchestrate: boolean;
  roles?: Partial<Record<TakomiRole, TakomiDispatchDefaults>>;
  stages?: Partial<Record<VibeLifecycleStage, TakomiDispatchDefaults>>;
  review?: TakomiReviewProfile;
};

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
  executionMode: "direct" | "orchestrate";
  sessionRecommendation: "none" | "consider" | "create";
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
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  parentTaskId?: string;
  preferredAgent?: string;
  preferredModelHint?: string;
  preferredModel?: string;
  preferredThinking?: TakomiThinkingLevel;
  fallbackModels?: string[];
  dispatchPolicy?: TakomiDispatchPolicy;
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

export type LifecycleStageState = {
  status: OrchestratorTaskStatus;
  taskIds: string[];
  canExpand?: boolean;
  expandedAt?: string;
  notes?: string;
};

export type SessionIntent = "full-project" | "feature-scope" | "follow-up-task";

export type OrchestratorSessionState = {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: "hybrid";
  lifecycle: Record<VibeLifecycleStage, LifecycleStageState>;
  sessionIntent?: SessionIntent;
  tasks: OrchestratorTask[];
};

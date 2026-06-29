import type { TakomiWorkflowId, WorkflowDefinition } from "./types";

const VIBE_GENESIS_PLAYBOOK = `Genesis fallback summary: author the project foundation in markdown, with PRD, FR issues, coding guidelines, architecture decisions, data models, API contracts, implementation strategy, and a clean handoff. For broad projects, Genesis may also create the orchestration session that carries the work into UI/UX Design and Build. The runtime should prefer .pi/prompts/genesis-prompt.md; this string exists only as a compatibility fallback.`;
const VIBE_DESIGN_PLAYBOOK = `Design fallback summary: define UI/UX only: visual system, user journeys, interaction flows, mockups, accessibility expectations, and frontend builder constraints in markdown. Technical architecture, data models, and API contracts belong in Genesis or Architect planning. The runtime should prefer .pi/prompts/design-prompt.md; this string exists only as a compatibility fallback.`;
const VIBE_BUILD_PLAYBOOK = `Build fallback summary: implement the approved plan with FR-driven work, strict verification, mockup adherence, and explicit handoff reporting. The runtime should prefer .pi/prompts/build-prompt.md; this string exists only as a compatibility fallback.`;
export const WORKFLOWS: Record<TakomiWorkflowId, WorkflowDefinition> = {
  "vibe-genesis": {
    id: "vibe-genesis",
    stage: "genesis",
    title: "Vibe Genesis",
    purpose: "Initialize a project with markdown blueprints, technical planning, and a clean handoff into UI/UX Design or Build. See .pi/prompts/genesis-prompt.md for the canonical behavior.",
    preferredRole: "architect",
    preferredAgent: "architect",
    nextStage: "design",
    playbook: VIBE_GENESIS_PLAYBOOK,
  },
  "vibe-design": {
    id: "vibe-design",
    stage: "design",
    title: "Vibe Design",
    purpose: "Define UI/UX only: visual system, user journeys, interaction flows, mockups, accessibility expectations, and frontend builder constraints before implementation begins. See .pi/prompts/design-prompt.md for the canonical behavior.",
    preferredRole: "design",
    preferredAgent: "designer",
    preferredModelHint: "Prefer Gemini 3.1 Pro Preview or another strong design-capable model actually available in Pi.",
    nextStage: "build",
    playbook: VIBE_DESIGN_PLAYBOOK,
  },
  "vibe-build": {
    id: "vibe-build",
    stage: "build",
    title: "Vibe Build",
    purpose: "Execute the approved plan with FR-based implementation, strict verification, mockup adherence, and explicit handoff reporting. See .pi/prompts/build-prompt.md for the canonical behavior.",
    preferredRole: "orchestrator",
    preferredAgent: "orchestrator",
    playbook: VIBE_BUILD_PLAYBOOK,
  },
};

export function listWorkflowDefinitions(): WorkflowDefinition[] {
  return Object.values(WORKFLOWS);
}

export function getWorkflowDefinition(id: TakomiWorkflowId): WorkflowDefinition {
  return WORKFLOWS[id];
}

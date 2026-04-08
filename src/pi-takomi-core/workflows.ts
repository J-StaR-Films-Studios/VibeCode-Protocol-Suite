import type { TakomiWorkflowId, WorkflowDefinition } from "./types";

export const WORKFLOWS: Record<TakomiWorkflowId, WorkflowDefinition> = {
  "vibe-genesis": {
    id: "vibe-genesis",
    stage: "genesis",
    title: "Vibe Genesis",
    purpose: "Discover the problem, clarify scope, define requirements, and create the project foundation before design or implementation.",
    preferredRole: "architect",
    preferredAgent: "architect",
    nextStage: "design",
    playbook: [
      "Vibe Genesis playbook:",
      "1. Clarify the product goal, target users, and constraints.",
      "2. Identify must-haves, should-haves, and explicit non-goals.",
      "3. Translate the request into a compact requirements brief.",
      "4. Define acceptance criteria and implementation boundaries.",
      "5. Recommend the next stage: usually Vibe Design, then Vibe Build.",
      "Output should feel like a focused project genesis packet, not raw brainstorming.",
    ].join("\n"),
  },
  "vibe-design": {
    id: "vibe-design",
    stage: "design",
    title: "Vibe Design",
    purpose: "Turn the approved genesis into a visual and UX direction before build execution.",
    preferredRole: "design",
    preferredAgent: "designer",
    preferredModelHint: "Prefer Gemini or another strong design-oriented cloud model for this stage.",
    nextStage: "build",
    playbook: [
      "Vibe Design playbook:",
      "1. Read the approved genesis context first.",
      "2. Extract the core user flows, visual language, and interface priorities.",
      "3. Propose design-system direction, layouts, and interaction patterns.",
      "4. Make explicit decisions about look, tone, hierarchy, and responsiveness.",
      "5. Hand off a concrete build-ready design summary to the build stage.",
      "For this stage, prefer a Gemini-class or similarly strong design-capable cloud model when available.",
    ].join("\n"),
  },
  "vibe-build": {
    id: "vibe-build",
    stage: "build",
    title: "Vibe Build",
    purpose: "Execute implementation through an orchestrated build loop using specialist agents, review passes, and iterative fixes.",
    preferredRole: "orchestrator",
    preferredAgent: "orchestrator",
    playbook: [
      "Vibe Build playbook:",
      "1. Start from approved genesis and, if available, approved design output.",
      "2. Break the work into concrete tasks with ownership and order.",
      "3. Dispatch implementation to specialist subagents.",
      "4. Review results, send fixes back to the same agent when continuity is useful, or route to another specialist when needed.",
      "5. Keep iterating until the task set is complete and reviewed.",
      "6. Always report current stage, completed tasks, blocked tasks, and recommended next actions.",
      "This stage should feel like active orchestration, not one-shot coding.",
    ].join("\n"),
  },
};

export function listWorkflowDefinitions(): WorkflowDefinition[] {
  return Object.values(WORKFLOWS);
}

export function getWorkflowDefinition(id: TakomiWorkflowId): WorkflowDefinition {
  return WORKFLOWS[id];
}

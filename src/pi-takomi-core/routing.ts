import { getWorkflowDefinition } from "./workflows";
import type { RouteDecision, TakomiRole, TakomiWorkflowId, VibeLifecycleStage } from "./types";

function stageToWorkflow(stage: VibeLifecycleStage): TakomiWorkflowId {
  switch (stage) {
    case "genesis":
      return "vibe-genesis";
    case "design":
      return "vibe-design";
    case "build":
    default:
      return "vibe-build";
  }
}

export function detectLifecycleStage(text: string): VibeLifecycleStage | undefined {
  const lowered = text.toLowerCase();
  if (/(\bgenesis\b|\brequirements\b|\bprd\b|\bscope\b|\bplan first\b)/.test(lowered)) return "genesis";
  if (/(\bdesign\b|\bux\b|\bui\b|\bmockup\b|\bwireframe\b|\bvisual\b)/.test(lowered)) return "design";
  if (/(\bbuild\b|\bimplement\b|\bcode\b|\bship\b|\bwire up\b)/.test(lowered)) return "build";
  return undefined;
}

export function detectRole(text: string): TakomiRole | undefined {
  const lowered = text.toLowerCase();
  if (/(\borchestrate\b|\bcoordinate\b|\bbreak this down\b|\bmulti-step\b|\bmulti step\b)/.test(lowered)) return "orchestrator";
  if (/(\barchitect\b|\bdesign the system\b|\bplan\b|\bspec\b)/.test(lowered)) return "architect";
  if (/(\bdesign\b|\bdesigner\b|\bmockup\b|\bvisual\b)/.test(lowered)) return "design";
  if (/(\bcode\b|\bimplement\b|\bbuild\b|\bfix\b)/.test(lowered)) return "code";
  if (/(\breview\b|\baudit\b|\bcheck\b|\bqa\b)/.test(lowered)) return "review";
  return undefined;
}

export function decideRoute(text: string): RouteDecision {
  const explicitStage = detectLifecycleStage(text);
  const explicitRole = detectRole(text);

  if (explicitStage) {
    const workflow = stageToWorkflow(explicitStage);
    const def = getWorkflowDefinition(workflow);
    return {
      role: explicitRole ?? def.preferredRole,
      workflow,
      stage: explicitStage,
      reason: `Matched lifecycle stage ${explicitStage}.`,
    };
  }

  if (explicitRole) {
    return {
      role: explicitRole,
      reason: `Matched role ${explicitRole}.`,
    };
  }

  const lowered = text.toLowerCase();
  const broad = lowered.length > 220 || (lowered.match(/\b(and|then|also|after|while)\b/g) ?? []).length >= 2;
  if (broad) {
    return {
      role: "orchestrator",
      workflow: "vibe-build",
      stage: "build",
      reason: "Broad request defaults to orchestrated build flow.",
    };
  }

  return {
    role: "general",
    reason: "No strong route detected; stay adaptive.",
  };
}

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
  if (/(\bgenesis\b|\brequirements\b|\bprd\b|\bscope\b|\bplan first\b|\bblueprint\b)/.test(lowered)) return "genesis";
  if (/(\bdesign\b|\bux\b|\bui\b|\bmockup\b|\bwireframe\b|\bvisual\b)/.test(lowered)) return "design";
  if (/(\bbuild\b|\bimplement\b|\bcode\b|\bship\b|\bwire up\b|\bfeature\b)/.test(lowered)) return "build";
  return undefined;
}

export function detectRole(text: string): TakomiRole | undefined {
  const lowered = text.toLowerCase();
  if (/(\borchestrate\b|\bcoordinate\b|\bbreak this down\b|\bmulti-step\b|\bmulti step\b|\borchestration session\b)/.test(lowered)) return "orchestrator";
  if (/(\barchitect\b|\bdesign the system\b|\bplan\b|\bspec\b)/.test(lowered)) return "architect";
  if (/(\bdesign\b|\bdesigner\b|\bmockup\b|\bvisual\b)/.test(lowered)) return "design";
  if (/(\bcode\b|\bimplement\b|\bbuild\b|\bfix\b)/.test(lowered)) return "code";
  if (/(\breview\b|\baudit\b|\bcheck\b|\bqa\b)/.test(lowered)) return "review";
  return undefined;
}

function isFollowUpExpansionRequest(lowered: string): boolean {
  return /(\bcontinue\b|\bexpand\b|\badd\b|\bnext\b|\bfollow[- ]?up\b|\bcome back\b|\bworking on\b)/.test(lowered);
}

export function decideRoute(text: string): RouteDecision {
  const lowered = text.toLowerCase();
  const explicitStage = detectLifecycleStage(text);
  const explicitRole = detectRole(text);
  const orchestrationSignal = /(\buse takomi\b|\borchestration session\b|\bbreak this down\b|\bcoordinate\b|\bmulti[- ]part\b|\bmulti[- ]step\b)/.test(lowered);
  const connectors = (lowered.match(/\b(and|then|also|after|while|plus)\b/g) ?? []).length;
  const broad = lowered.length > 220 || connectors >= 2;
  const bigBuildSignal = /(\bminimum usable\b|\bmus\b|\bseveral features\b|\bmultiple features\b|\bwhole project\b|\bfull project\b|\bend to end\b)/.test(lowered);
  const followUp = isFollowUpExpansionRequest(lowered);

  if (explicitStage) {
    const workflow = stageToWorkflow(explicitStage);
    const def = getWorkflowDefinition(workflow);
    const shouldOrchestrate = orchestrationSignal || broad || bigBuildSignal || (followUp && explicitStage === "build");
    return {
      role: explicitRole ?? def.preferredRole,
      workflow,
      stage: explicitStage,
      executionMode: shouldOrchestrate ? "orchestrate" : "direct",
      sessionRecommendation: shouldOrchestrate ? (broad || bigBuildSignal ? "create" : "consider") : "none",
      reason: `Matched lifecycle stage ${explicitStage}.`,
    };
  }

  if (explicitRole) {
    const orchestrationRole = explicitRole === "orchestrator";
    return {
      role: explicitRole,
      executionMode: orchestrationRole ? "orchestrate" : "direct",
      sessionRecommendation: orchestrationRole ? "create" : "none",
      reason: `Matched role ${explicitRole}.`,
    };
  }

  if (orchestrationSignal || broad || bigBuildSignal) {
    return {
      role: "orchestrator",
      workflow: "vibe-build",
      stage: "build",
      executionMode: "orchestrate",
      sessionRecommendation: followUp || bigBuildSignal || broad ? "create" : "consider",
      reason: followUp
        ? "Follow-up request appears large enough to merit orchestration."
        : "Broad request defaults to orchestrated Takomi lifecycle handling.",
    };
  }

  return {
    role: "general",
    executionMode: "direct",
    sessionRecommendation: followUp ? "consider" : "none",
    reason: followUp
      ? "Follow-up request may still fit direct execution; decide whether a new session is actually necessary."
      : "No strong route detected; stay adaptive.",
  };
}

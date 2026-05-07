import type { TakomiDispatchInput } from "./dispatch";

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

export function hasThinkingSuffix(model?: string): boolean {
  return /:(off|minimal|low|medium|high|xhigh)$/i.test(model ?? "");
}

export function buildFallbackModels(input: TakomiDispatchInput): string[] {
  return uniqueStrings([
    input.agent.model,
    ...(input.fallbackModels ?? []),
    ...(input.agent.fallbackModels ?? []),
  ]);
}

export function buildSystemPrompt(input: TakomiDispatchInput): string {
  return [
    input.agent.systemPrompt,
    input.workflow ? `\nUse the ${input.workflow} workflow for this task.` : "",
    input.skills?.length ? `\nUse these skills when relevant: ${input.skills.join(", ")}.` : "",
    input.thinking ? `\nUse Pi thinking level '${input.thinking}' for this delegated run when the selected model supports it.` : "",
  ].filter(Boolean).join("\n");
}

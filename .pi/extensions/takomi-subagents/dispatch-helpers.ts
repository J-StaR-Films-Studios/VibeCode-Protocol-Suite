import fs from "node:fs";
import path from "node:path";
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

function buildPrimeStub(input: TakomiDispatchInput): string {
  const checklist = [
    "Prime context before work: inspect the repo docs and current task state.",
    "Follow the role prompt and assigned workflow.",
    "Use repo context as the source of truth; do not rely on optional skills as a prerequisite.",
  ];
  if (input.workflow) checklist.push(`This task uses the ${input.workflow} workflow.`);
  return [`Takomi subagent preflight:`, ...checklist].join("\n");
}

function stripPromptFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function workflowPromptFile(workflow?: string): string | undefined {
  if (workflow === "vibe-genesis") return "genesis-prompt.md";
  if (workflow === "vibe-design") return "design-prompt.md";
  if (workflow === "vibe-build") return "build-prompt.md";
  return undefined;
}

function loadWorkflowPrompt(input: TakomiDispatchInput): string | undefined {
  const fileName = workflowPromptFile(input.workflow);
  if (!fileName) return undefined;
  const promptPath = path.join(input.rootCwd, ".pi", "prompts", fileName);
  try {
    const prompt = stripPromptFrontmatter(fs.readFileSync(promptPath, "utf8"));
    return prompt ? [`Full assigned workflow loaded from ${path.relative(input.rootCwd, promptPath)}:`, prompt].join("\n\n") : undefined;
  } catch {
    return undefined;
  }
}

export function buildSystemPrompt(input: TakomiDispatchInput): string {
  return [
    input.agent.systemPrompt,
    buildPrimeStub(input),
    loadWorkflowPrompt(input) ?? (input.workflow ? `\nUse the ${input.workflow} workflow for this task.` : ""),
    input.skills?.length ? `\nOptional skill/context overlays for this task: ${input.skills.join(", ")}. Use them only if available and genuinely helpful; otherwise rely on the harness workflow and repo context.` : "",
    input.thinking ? `\nUse Pi thinking level '${input.thinking}' for this delegated run when the selected model supports it.` : "",
  ].filter(Boolean).join("\n");
}

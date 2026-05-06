import type { VibeLifecycleStage } from "../../../src/pi-takomi-core";
import type { TakomiRuntimeCommandState } from "./commands";
import type { TakomiSubagentController } from "./subagent-types";

export type TakomiCompletion = {
  value: string;
  label: string;
  description: string;
};

const ROOT_COMPLETIONS: TakomiCompletion[] = [
  { value: "genesis", label: "genesis", description: "Run the Genesis planning stage" },
  { value: "design", label: "design", description: "Run UI/UX design from approved scope" },
  { value: "build", label: "build", description: "Implement against the agreed UI" },
  { value: "plan", label: "plan", description: "Create or update the orchestration plan" },
  { value: "mode", label: "mode", description: "Set direct, orchestrate, or review mode" },
  { value: "gate", label: "gate", description: "Set auto or review-gated execution" },
  { value: "subagents", label: "subagents", description: "Control subagent usage and view" },
];

const SUBCOMMAND_COMPLETIONS: Record<string, TakomiCompletion[]> = {
  mode: [
    { value: "direct", label: "direct", description: "Handle work directly unless delegation is explicit" },
    { value: "orchestrate", label: "orchestrate", description: "Plan and delegate broad work" },
    { value: "review", label: "review", description: "Inspect outputs and route fixes" },
  ],
  gate: [
    { value: "review", label: "review", description: "Return to the user after each task" },
    { value: "auto", label: "auto", description: "Continue approved plans automatically" },
  ],
  subagents: [
    { value: "status", label: "status", description: "Show active subagents" },
    { value: "on", label: "on", description: "Allow subagent delegation" },
    { value: "off", label: "off", description: "Disable subagent delegation" },
  ],
};

const SUBCOMMAND_ALIASES: Record<string, string> = {
  subagent: "subagents",
};

function normalizeSubcommand(value: string): string {
  return SUBCOMMAND_ALIASES[value] ?? value;
}

function matchesToken(completion: TakomiCompletion, token: string): boolean {
  const lowered = token.toLowerCase();
  return !lowered || completion.value.toLowerCase().startsWith(lowered) || completion.label.toLowerCase().startsWith(lowered);
}

function withArgumentPrefix(parent: string, completions: TakomiCompletion[], token: string): TakomiCompletion[] {
  return completions
    .filter((completion) => matchesToken(completion, token))
    .map((completion) => ({
      ...completion,
      value: `${parent} ${completion.value}`,
    }));
}

export function commandHelp(): string {
  return [
    "Takomi commands:",
    "/takomi genesis [prompt]",
    "/takomi design [prompt]",
    "/takomi build [prompt]",
    "/takomi plan [title]",
    "/takomi mode <direct|orchestrate|review>",
    "/takomi gate <auto|review>",
    "/takomi subagents <on|off|status>",
    "/takomi-status",
    "/takomi-reset",
  ].join("\n");
}

export function workflowPrompt(stage: VibeLifecycleStage, suppliedPrompt?: string): string {
  const suffix = suppliedPrompt?.trim() ? `\n\nPrompt: ${suppliedPrompt.trim()}` : "";
  const lines = {
    genesis: [
      "Takomi Genesis is active.",
      "Use existing markdown/project context when no extra prompt is supplied.",
      "Strictly follow the Genesis playbook: clarify scope, create or update planning docs, and do not implement code yet.",
    ],
    design: [
      "Takomi Design is active.",
      "Focus on UI/UX only: agreed screens, visual direction, interaction states, mockups, and build constraints.",
      "Do not drift into route/API architecture unless the user explicitly asks.",
    ],
    build: [
      "Takomi Build is active.",
      "Implement against the approved UI and continuously cross-check code against design artifacts and acceptance criteria.",
    ],
  }[stage];
  return [...lines, suffix].filter(Boolean).join("\n");
}

export function statusText(state: TakomiRuntimeCommandState, subagentController: TakomiSubagentController): string {
  return [
    `Takomi: ${state.enabled ? "on" : "off"}`,
    `Mode: ${state.role}`,
    `Stage: ${state.stage ?? "-"}`,
    `Workflow: ${state.workflow ?? "-"}`,
    `Plan bias: ${state.planMode ? "on" : "off"}`,
    `Execution gate: ${state.launchMode === "manual" ? "review" : "auto"}`,
    `Subagents: ${state.subagentsEnabled ? "on" : "off"}`,
    state.activeSessionId ? `Session: ${state.activeSessionId}` : "",
    "",
    subagentController.getStatusSummary(),
  ].filter(Boolean).join("\n");
}

export function completions(argumentPrefix: string): TakomiCompletion[] {
  const input = argumentPrefix.trimStart();
  const parts = input.split(/\s+/).filter(Boolean);
  const hasTrailingSpace = /\s$/.test(input);

  if (parts.length === 0) return ROOT_COMPLETIONS;
  if (parts.length === 1 && !hasTrailingSpace) {
    return ROOT_COMPLETIONS.filter((completion) => matchesToken(completion, parts[0]));
  }

  const parent = normalizeSubcommand(parts[0]);
  const nested = SUBCOMMAND_COMPLETIONS[parent] ?? [];
  const token = hasTrailingSpace ? "" : parts[parts.length - 1] ?? "";
  return withArgumentPrefix(parent, nested, token);
}

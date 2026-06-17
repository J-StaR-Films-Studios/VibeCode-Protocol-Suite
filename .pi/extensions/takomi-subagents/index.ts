import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderTakomiSubagentCall, renderTakomiSubagentResult } from "./native-render";
import { executeTakomiSubagentTool } from "./tool-runner";

const ChecklistItemSchema = Type.Object({
  text: Type.String(),
  done: Type.Optional(Type.Boolean()),
});

const ThinkingSchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

const TaskSchema = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  workflow: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.String())),
  model: Type.Optional(Type.String()),
  fallbackModels: Type.Optional(Type.Array(Type.String())),
  thinking: Type.Optional(ThinkingSchema),
  conversationId: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]))),
});

const SubagentParameters = Type.Object({
  agent: Type.Optional(Type.String({ description: "Agent name for single execution" })),
  task: Type.Optional(Type.String({ description: "Task for single execution" })),
  workflow: Type.Optional(Type.String({ description: "Workflow or playbook overlay for this task" })),
  skills: Type.Optional(Type.Array(Type.String(), { description: "Extra skills to apply during the task" })),
  model: Type.Optional(Type.String({ description: "Optional per-run model override" })),
  fallbackModels: Type.Optional(Type.Array(Type.String(), { description: "Optional ordered model fallback list" })),
  thinking: Type.Optional(ThinkingSchema),
  conversationId: Type.Optional(Type.String({ description: "Persistent conversation id to resume the same subagent session" })),
  cwd: Type.Optional(Type.String({ description: "Working directory override" })),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]), { description: "Optional checklist for the subagent" })),
  tasks: Type.Optional(Type.Array(TaskSchema, { description: "Parallel subagent tasks" })),
  confirmLaunch: Type.Optional(Type.Boolean({ description: "Required to launch immediately in manual Takomi launch mode" })),
  previewOnly: Type.Optional(Type.Boolean({ description: "Return the delegation plan without launching" })),
  clarify: Type.Optional(Type.Boolean({ description: "Show the native pi-subagents TUI to preview/edit before execution. Especially useful for chains; requires an interactive Pi TUI." })),
  chain: Type.Optional(Type.Array(TaskSchema, { description: "Sequential chain of subagent tasks" })),
  agentScope: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("project"), Type.Literal("both")])),
  confirmProjectAgents: Type.Optional(Type.Boolean({ description: "Prompt before running project-local agents. Default: true." })),
  overrideUserBlock: Type.Optional(Type.Boolean({ description: "Only set true when the user explicitly approves retrying after a blocked/cancelled/review-gated launch." })),
});

function registerSubagentTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "takomi_subagent",
    label: "Takomi",
    description: "Run subagents with Pi-style single, parallel, or chain modes plus Takomi lifecycle metadata.",
    promptSnippet: "Delegate lifecycle-aware Takomi work to specialist subagents. Use single, tasks, or chain; reuse conversationId for review loops.",
    promptGuidelines: [
      "Use this tool during orchestration when a specialist should handle a task.",
      "Use tasks for independent parallel work and chain for dependent handoffs with {previous}.",
      "Set clarify=true when the user asks to preview/edit a subagent run in the native Pi TUI before launch.",
      "Use model, fallbackModels, and thinking only when deliberate; otherwise let the agent/profile defaults apply.",
      "If review sends work back to the same agent, reuse the same conversationId for continuity.",
      "If a launch is blocked, cancelled, paused, or review-gated, do not retry automatically; wait for the user's next prompt. Use overrideUserBlock only after explicit user approval.",
    ],
    parameters: SubagentParameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return executeTakomiSubagentTool(pi, params, signal, onUpdate as any, ctx);
    },
    renderCall: renderTakomiSubagentCall,
    renderResult: renderTakomiSubagentResult,
  });
}

export default function takomiSubagents(pi: ExtensionAPI) {
  registerSubagentTool(pi);
}

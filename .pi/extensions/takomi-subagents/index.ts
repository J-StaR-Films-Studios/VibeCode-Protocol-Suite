import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { discoverProjectAgents, type TakomiAgentConfig } from "./agents";
import { dispatchTakomiSubagent, type TakomiDispatchResult } from "./dispatch";
import {
  TAKOMI_SUBAGENT_EVENT_CHANNEL,
  type TakomiSubagentRuntimeEvent,
} from "../takomi-runtime/subagent-types";

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

function emitRuntimeSubagentEvent(pi: ExtensionAPI, event: TakomiSubagentRuntimeEvent): void {
  pi.events.emit(TAKOMI_SUBAGENT_EVENT_CHANNEL, event);
}

function resultText(result: TakomiDispatchResult): string {
  return [
    result.preflight,
    result.output || result.stderr || `Subagent ${result.agent} finished without output.`,
  ].filter(Boolean).join("\n\n");
}

export default function takomiSubagents(pi: ExtensionAPI) {
  pi.registerTool({
    name: "takomi_subagent",
    label: "Takomi Subagent",
    description: "Run a project-local Takomi subagent in a separate Pi process. Supports chain execution, model/thinking overrides, and persisted conversation IDs.",
    promptSnippet: "Delegate work to a specialist Takomi subagent. Reuse conversationId to continue the same subagent session.",
    promptGuidelines: [
      "Use this tool during orchestration when a specialist should handle a task.",
      "Use model, fallbackModels, and thinking only when deliberate; otherwise let the agent/profile defaults apply.",
      "If review sends work back to the same agent, reuse the same conversationId for continuity.",
    ],
    parameters: Type.Object({
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
      chain: Type.Optional(Type.Array(TaskSchema, { description: "Sequential chain of subagent tasks" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const rootCwd = params.cwd ? path.resolve(ctx.cwd, params.cwd) : ctx.cwd;
      const agents = discoverProjectAgents(rootCwd);
      const byName = new Map<string, TakomiAgentConfig>(agents.map((agent) => [agent.name, agent]));

      const tasks = params.chain && params.chain.length > 0
        ? params.chain
        : params.agent && params.task
          ? [{
              agent: params.agent,
              task: params.task,
              workflow: params.workflow,
              skills: params.skills,
              model: params.model,
              fallbackModels: params.fallbackModels,
              thinking: params.thinking,
              conversationId: params.conversationId,
              cwd: params.cwd,
              checklist: params.checklist,
            }]
          : [];

      if (tasks.length === 0) {
        return {
          content: [{ type: "text", text: "No subagent task provided." }],
          details: { results: [], availableAgents: agents.map((agent) => agent.name) },
          isError: true,
        };
      }

      const results: TakomiDispatchResult[] = [];
      let previousOutput = "";

      for (const item of tasks) {
        const config = byName.get(item.agent);
        if (!config) {
          return {
            content: [{ type: "text", text: `Unknown subagent '${item.agent}'. Available: ${agents.map((agent) => agent.name).join(", ")}` }],
            details: { results, availableAgents: agents.map((agent) => agent.name) },
            isError: true,
          };
        }

        const result = await dispatchTakomiSubagent(ctx, {
          agent: config,
          task: item.task.replaceAll("{previous}", previousOutput),
          rootCwd,
          cwd: item.cwd,
          workflow: item.workflow,
          skills: item.skills,
          model: item.model,
          fallbackModels: item.fallbackModels,
          thinking: item.thinking,
          conversationId: item.conversationId,
          checklist: item.checklist,
          source: "takomi-tool",
        }, signal, {
          emit: (event) => emitRuntimeSubagentEvent(pi, event),
        });

        previousOutput = result.output;
        results.push(result);

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: resultText(result) }],
            details: { results },
            isError: true,
          };
        }
      }

      return {
        content: [{ type: "text", text: results.map(resultText).join("\n\n---\n\n") }],
        details: { results },
      };
    },
  });
}

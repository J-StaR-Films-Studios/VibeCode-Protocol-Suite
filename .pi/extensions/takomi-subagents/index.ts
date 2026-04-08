import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { discoverProjectAgents } from "./agents";

const ChecklistItemSchema = Type.Object({
  text: Type.String(),
  done: Type.Optional(Type.Boolean()),
});

const TaskSchema = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  workflow: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.String())),
  model: Type.Optional(Type.String()),
  conversationId: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]))),
});

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript) return { command: process.execPath, args: [currentScript, ...args] };
  return { command: "pi", args };
}

function formatChecklist(checklist?: Array<string | { text: string; done?: boolean }>): string {
  if (!checklist?.length) return "";
  return [
    "Checklist:",
    ...checklist.map((item) => typeof item === "string" ? `- [ ] ${item}` : `- [${item.done ? "x" : " "}] ${item.text}`),
  ].join("\n");
}

function buildTaskPrompt(task: {
  task: string;
  workflow?: string;
  skills?: string[];
  checklist?: Array<string | { text: string; done?: boolean }>;
}): string {
  return [
    task.workflow ? `Workflow: ${task.workflow}` : "",
    task.skills?.length ? `Skills: ${task.skills.join(", ")}` : "",
    formatChecklist(task.checklist),
    "Task:",
    task.task,
  ].filter(Boolean).join("\n\n");
}

async function writePrompt(agentName: string, prompt: string) {
  const tmpDir = path.join(os.tmpdir(), `takomi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${agentName}.md`);
  await writeFile(filePath, prompt, "utf8");
  return filePath;
}

async function runAgent(cwd: string, args: string[], signal?: AbortSignal): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    proc.on("error", () => resolve({ stdout, stderr, code: 1 }));
    if (signal) {
      const abort = () => proc.kill("SIGTERM");
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
  });
}

async function getAvailableModelKeys(ctx: { modelRegistry: { getAvailable: () => Promise<Array<{ provider: string; id: string }>> } }): Promise<string[]> {
  const available = await ctx.modelRegistry.getAvailable().catch(() => []);
  return available.flatMap((model) => [`${model.provider}/${model.id}`, model.id]);
}

async function resolvePreferredModel(ctx: { modelRegistry: { getAvailable: () => Promise<Array<{ provider: string; id: string }>> } }, requested?: string, fallback?: string): Promise<{ model?: string; warning?: string }> {
  const candidates = [requested, fallback].filter(Boolean) as string[];
  if (candidates.length === 0) return {};
  const keys = await getAvailableModelKeys(ctx);
  const exact = candidates.find((candidate) => keys.includes(candidate));
  if (exact) return { model: exact };
  const loweredKeys = keys.map((key) => key.toLowerCase());
  for (const candidate of candidates) {
    const idx = loweredKeys.findIndex((key) => key === candidate.toLowerCase());
    if (idx >= 0) return { model: keys[idx] };
  }
  for (const candidate of candidates) {
    const idx = loweredKeys.findIndex((key) => key.includes(candidate.toLowerCase()) || candidate.toLowerCase().includes(key));
    if (idx >= 0) return { model: keys[idx], warning: `Requested model '${candidate}' was unavailable; using '${keys[idx]}' instead.` };
  }
  const firstAvailable = keys.find((key) => key.includes("/"));
  if (firstAvailable) return { model: firstAvailable, warning: `Requested models '${candidates.join("', '")}' were unavailable; using '${firstAvailable}' instead.` };
  return { warning: `No available signed-in model matched '${candidates.join("', '")}'.` };
}

export default function takomiSubagents(pi: ExtensionAPI) {
  pi.registerTool({
    name: "takomi_subagent",
    label: "Takomi Subagent",
    description: "Run a project-local Takomi subagent in a separate Pi process. Supports single or chain execution and can reuse conversation state via conversationId.",
    promptSnippet: "Delegate work to a specialist Takomi subagent. Reuse conversationId to send revisions back to the same agent.",
    promptGuidelines: [
      "Use this tool during orchestration when a specialist should handle a task.",
      "If review sends work back to the same agent, reuse the same conversationId for continuity.",
    ],
    parameters: Type.Object({
      agent: Type.Optional(Type.String({ description: "Agent name for single execution" })),
      task: Type.Optional(Type.String({ description: "Task for single execution" })),
      workflow: Type.Optional(Type.String({ description: "Workflow or playbook overlay for this task" })),
      skills: Type.Optional(Type.Array(Type.String(), { description: "Extra skills to apply during the task" })),
      model: Type.Optional(Type.String({ description: "Optional per-run model override" })),
      conversationId: Type.Optional(Type.String({ description: "Persistent conversation id to resume the same subagent session" })),
      cwd: Type.Optional(Type.String({ description: "Working directory override" })),
      checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]), { description: "Optional checklist for the subagent" })),
      chain: Type.Optional(Type.Array(TaskSchema, { description: "Sequential chain of subagent tasks" })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const rootCwd = params.cwd ? path.resolve(ctx.cwd, params.cwd) : ctx.cwd;
      const agents = discoverProjectAgents(rootCwd);
      const byName = new Map(agents.map((agent) => [agent.name, agent]));
      const subagentSessionDir = path.join(rootCwd, ".pi", "takomi", "subagents");
      await mkdir(subagentSessionDir, { recursive: true });

      const tasks = params.chain && params.chain.length > 0
        ? params.chain
        : params.agent && params.task
          ? [{
              agent: params.agent,
              task: params.task,
              workflow: params.workflow,
              skills: params.skills,
              model: params.model,
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

      const results: Array<Record<string, string | number>> = [];
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

        const effectiveTask = buildTaskPrompt({
          task: item.task.replaceAll("{previous}", previousOutput),
          workflow: item.workflow,
          skills: item.skills,
          checklist: item.checklist,
        });
        const promptPath = await writePrompt(config.name, [
          config.systemPrompt,
          item.workflow ? `\nUse the ${item.workflow} workflow for this task.` : "",
          item.skills?.length ? `\nUse these skills when relevant: ${item.skills.join(", ")}.` : "",
        ].filter(Boolean).join("\n"));
        const conversationId = item.conversationId || `${config.name}-${Date.now()}`;
        const sessionPath = path.join(subagentSessionDir, `${conversationId}.jsonl`);
        const subagentCwd = item.cwd ? path.resolve(rootCwd, item.cwd) : rootCwd;

        const resolvedModel = await resolvePreferredModel(ctx, item.model, config.model);
        const args = ["--append-system-prompt", promptPath, "-p", effectiveTask, "--session", sessionPath];
        if (resolvedModel.model) args.unshift("--model", resolvedModel.model);
        if (config.tools?.length) args.unshift("--tools", config.tools.join(","));

        const result = await runAgent(subagentCwd, args, signal);
        previousOutput = result.stdout.trim();
        results.push({
          agent: config.name,
          workflow: item.workflow ?? "",
          model: resolvedModel.model || "",
          warning: resolvedModel.warning || "",
          conversationId,
          code: result.code,
          output: previousOutput,
          stderr: result.stderr.trim(),
        });

        if (result.code !== 0) {
          return {
            content: [{ type: "text", text: `Subagent ${config.name} failed.\n\n${result.stderr || result.stdout || "No output"}` }],
            details: { results },
            isError: true,
          };
        }
      }

      return {
        content: [{ type: "text", text: previousOutput || "Subagent run complete." }],
        details: { results },
      };
    },
  });
}

import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { discoverProjectAgents } from "./agents";

const TaskSchema = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  conversationId: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
});

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript) return { command: process.execPath, args: [currentScript, ...args] };
  return { command: "pi", args };
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
      conversationId: Type.Optional(Type.String({ description: "Persistent conversation id to resume the same subagent session" })),
      cwd: Type.Optional(Type.String({ description: "Working directory override" })),
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
          ? [{ agent: params.agent, task: params.task, conversationId: params.conversationId, cwd: params.cwd }]
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

        const effectiveTask = item.task.replaceAll("{previous}", previousOutput);
        const promptPath = await writePrompt(config.name, config.systemPrompt);
        const conversationId = item.conversationId || `${config.name}-${Date.now()}`;
        const sessionPath = path.join(subagentSessionDir, `${conversationId}.jsonl`);
        const subagentCwd = item.cwd ? path.resolve(rootCwd, item.cwd) : rootCwd;

        const args = ["--append-system-prompt", promptPath, "-p", effectiveTask, "--session", sessionPath];
        if (config.model) args.unshift("--model", config.model);
        if (config.tools?.length) args.unshift("--tools", config.tools.join(","));

        const result = await runAgent(subagentCwd, args, signal);
        previousOutput = result.stdout.trim();
        results.push({
          agent: config.name,
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

import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { discoverProjectAgents, type TakomiAgentConfig } from "./agents";
import {
  TAKOMI_SUBAGENT_EVENT_CHANNEL,
  type TakomiSubagentRuntimeEvent,
} from "../takomi-runtime/subagent-types";

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

type RunHooks = {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

type JsonRunHooks = {
  onAssistantText?: (text: string) => void;
  onEventText?: (line: string) => void;
  onStderr?: (chunk: string) => void;
};

const JSON_OUTPUT_TAIL_LIMIT = 64_000;

function appendCappedTail(current: string, next: string, limit = JSON_OUTPUT_TAIL_LIMIT): string {
  if (!next) return current;
  const boundedNext = next.length > limit ? next.slice(-limit) : next;
  const remaining = limit - boundedNext.length;
  if (remaining <= 0) return boundedNext;
  if (current.length <= remaining) return current + boundedNext;
  return current.slice(-remaining) + boundedNext;
}

function extractAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is { type?: string; text?: string } => Boolean(block) && typeof block === "object")
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

function normalizeAssistantOutputText(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractAssistantSnapshot(event: Record<string, unknown>, currentText: string): string | undefined {
  const type = typeof event.type === "string" ? event.type : "";

  if (type === "message_update") {
    const assistantEvent = event.assistantMessageEvent;
    if (assistantEvent && typeof assistantEvent === "object") {
      const delta = (assistantEvent as { delta?: unknown }).delta;
      if (typeof delta === "string" && delta) {
        const next = normalizeAssistantOutputText(`${currentText}${delta}`);
        return next && next !== currentText ? next : undefined;
      }
    }

    const messageText = normalizeAssistantOutputText(extractAssistantText(event.message));
    return messageText && messageText !== currentText ? messageText : undefined;
  }

  if (type === "message_end") {
    const message = event.message;
    if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
      const messageText = normalizeAssistantOutputText(extractAssistantText(message));
      return messageText && messageText !== currentText ? messageText : undefined;
    }
  }

  if (type === "agent_end") {
    const messages = (event.messages as unknown[] | undefined) ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
        const messageText = normalizeAssistantOutputText(extractAssistantText(message));
        return messageText && messageText !== currentText ? messageText : undefined;
      }
    }
  }

  return undefined;
}

function summarizeJsonEvent(event: Record<string, unknown>): string | undefined {
  const type = typeof event.type === "string" ? event.type : "";
  if (type === "tool_execution_start") {
    const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
    return `Tool start: ${toolName}`;
  }
  if (type === "tool_execution_update") {
    const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
    const partial = event.partialResult;
    if (partial && typeof partial === "object") {
      const partialText = extractAssistantText(partial);
      if (partialText) return `${toolName}: ${partialText.split(/\r?\n/).find(Boolean)?.trim()}`;
      const details = (partial as { details?: { output?: string; stdout?: string } }).details;
      const output = details?.output ?? details?.stdout;
      if (typeof output === "string" && output.trim()) {
        return `${toolName}: ${output.split(/\r?\n/).find(Boolean)?.trim()}`;
      }
    }
    return `${toolName}: update`;
  }
  if (type === "tool_execution_end") {
    const toolName = typeof event.toolName === "string" ? event.toolName : "tool";
    const isError = event.isError === true;
    return isError ? `Tool failed: ${toolName}` : `Tool complete: ${toolName}`;
  }
  return undefined;
}

async function runAgent(cwd: string, args: string[], signal?: AbortSignal, hooks?: RunHooks): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      const chunk = d.toString();
      stdout += chunk;
      hooks?.onStdout?.(chunk);
    });
    proc.stderr.on("data", (d) => {
      const chunk = d.toString();
      stderr += chunk;
      hooks?.onStderr?.(chunk);
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

async function runAgentJson(cwd: string, args: string[], signal?: AbortSignal, hooks?: JsonRunHooks): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const invocation = getPiInvocation(args);
    const proc = spawn(invocation.command, invocation.args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
    let stdoutTail = "";
    let stderrTail = "";
    let lineBuffer = "";
    let finalAssistantText = "";
    let assistantOutputText = "";

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      stdoutTail = appendCappedTail(stdoutTail, `${line}\n`);
      try {
        const event = JSON.parse(trimmed) as Record<string, unknown>;
        const assistantText = extractAssistantSnapshot(event, assistantOutputText);
        if (assistantText !== undefined) {
          assistantOutputText = assistantText;
          hooks?.onAssistantText?.(assistantText);
        }

        const messageText = summarizeJsonEvent(event);
        if (messageText) hooks?.onEventText?.(messageText);

        if (event.type === "message_end") {
          const message = event.message;
          if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
            const text = extractAssistantText(message);
            if (text) finalAssistantText = normalizeAssistantOutputText(text);
          }
        }
        if (event.type === "agent_end") {
          const messages = (event.messages as unknown[] | undefined) ?? [];
          for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message && typeof message === "object" && (message as { role?: string }).role === "assistant") {
              const text = extractAssistantText(message);
              if (text) {
                finalAssistantText = normalizeAssistantOutputText(text);
                break;
              }
            }
          }
        }
      } catch {
        hooks?.onEventText?.(trimmed);
      }
    };

    proc.stdout.on("data", (d) => {
      lineBuffer += d.toString();
      let newlineIndex = lineBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = lineBuffer.slice(0, newlineIndex);
        lineBuffer = lineBuffer.slice(newlineIndex + 1);
        consumeLine(line);
        newlineIndex = lineBuffer.indexOf("\n");
      }
    });
    proc.stderr.on("data", (d) => {
      const chunk = d.toString();
      stderrTail = appendCappedTail(stderrTail, chunk);
      hooks?.onStderr?.(chunk);
    });
    proc.on("close", (code) => {
      if (lineBuffer.trim()) consumeLine(lineBuffer);
      resolve({ stdout: finalAssistantText || assistantOutputText || stdoutTail.trim(), stderr: stderrTail, code: code ?? 0 });
    });
    proc.on("error", () => resolve({ stdout: finalAssistantText || assistantOutputText || stdoutTail.trim(), stderr: stderrTail, code: 1 }));
    if (signal) {
      const abort = () => proc.kill("SIGTERM");
      if (signal.aborted) abort();
      else signal.addEventListener("abort", abort, { once: true });
    }
  });
}

async function getAvailableModelKeys(ctx: ExtensionContext): Promise<string[]> {
  try {
    const available = await Promise.resolve(ctx.modelRegistry.getAvailable());
    return available.flatMap((model) => [`${model.provider}/${model.id}`, model.id]);
  } catch {
    return [];
  }
}

async function resolvePreferredModel(ctx: ExtensionContext, requested?: string, fallback?: string): Promise<{ model?: string; warning?: string }> {
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

async function listModelsViaPi(cwd: string, signal?: AbortSignal): Promise<{ ok: boolean; output: string }> {
  const result = await runAgent(cwd, ["--list-models"], signal);
  const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n").trim();
  return { ok: result.code === 0 && Boolean(output), output: output || "No model list output returned." };
}

async function runModelPreflight(ctx: ExtensionContext, cwd: string, requested?: string, fallback?: string, signal?: AbortSignal): Promise<{ model?: string; warning?: string; report: string; cliOk: boolean }> {
  const cli = await listModelsViaPi(cwd, signal);
  const resolved = await resolvePreferredModel(ctx, requested, fallback);
  const requestedSummary = [requested, fallback].filter(Boolean).join(" -> ") || "auto";
  const status = resolved.model
    ? `Selected model: ${resolved.model}`
    : `No confirmed model matched request: ${requestedSummary}`;
  const report = [
    "Model preflight (`pi --list-models`)",
    cli.ok ? cli.output : `Preflight command failed or was empty.\n${cli.output}`,
    "",
    `Requested: ${requestedSummary}`,
    status,
    resolved.warning ? `Warning: ${resolved.warning}` : "",
  ].filter(Boolean).join("\n");
  return { ...resolved, report, cliOk: cli.ok };
}

function emitRuntimeSubagentEvent(pi: ExtensionAPI, event: TakomiSubagentRuntimeEvent): void {
  pi.events.emit(TAKOMI_SUBAGENT_EVENT_CHANNEL, event);
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
      const agents: TakomiAgentConfig[] = discoverProjectAgents(rootCwd);
      const byName = new Map<string, TakomiAgentConfig>(agents.map((agent: TakomiAgentConfig) => [agent.name, agent]));
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
          details: { results: [], availableAgents: agents.map((agent: TakomiAgentConfig) => agent.name) },
          isError: true,
        };
      }

      const results: Array<Record<string, string | number>> = [];
      let previousOutput = "";

      for (const item of tasks) {
        const config = byName.get(item.agent);
        if (!config) {
          return {
            content: [{ type: "text", text: `Unknown subagent '${item.agent}'. Available: ${agents.map((agent: TakomiAgentConfig) => agent.name).join(", ")}` }],
            details: { results, availableAgents: agents.map((agent: TakomiAgentConfig) => agent.name) },
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

        emitRuntimeSubagentEvent(pi, {
          type: "start",
          runKey: conversationId,
          state: {
          agent: config.name,
          taskLabel: item.task.split(/\r?\n/)[0]?.trim() || item.agent,
          workflow: item.workflow,
          conversationId,
          checklist: item.checklist,
          summary: "Preparing delegated run.",
          source: "takomi-tool",
          },
        });

        const preflight = await runModelPreflight(ctx, subagentCwd, item.model, config.model, signal);
        if (preflight.model) {
          emitRuntimeSubagentEvent(pi, {
            type: "update",
            runKey: conversationId,
            patch: { model: preflight.model, summary: `Model ready: ${preflight.model}` },
          });
        }
        if (!preflight.model) {
          results.push({
            agent: config.name,
            workflow: item.workflow ?? "",
            model: "",
            warning: preflight.warning || "",
            conversationId,
            code: 1,
            output: "",
            stderr: preflight.report,
          });
          emitRuntimeSubagentEvent(pi, {
            type: "block",
            runKey: conversationId,
            patch: {
              summary: `Subagent ${config.name} blocked before launch.`,
              logs: [preflight.warning || "No model matched the requested run."],
            },
          });
          return {
            content: [{ type: "text", text: `Subagent ${config.name} blocked before launch.\n\n${preflight.report}` }],
            details: { results, preflight },
            isError: true,
          };
        }

        const args = ["--mode", "json", "--append-system-prompt", promptPath, "--session", sessionPath, effectiveTask];
        args.unshift("--model", preflight.model);
        if (config.tools?.length) args.unshift("--tools", config.tools.join(","));

        const result = await runAgentJson(subagentCwd, args, signal, {
          onAssistantText: (text) => {
            emitRuntimeSubagentEvent(pi, { type: "update", runKey: conversationId, patch: { outputText: text } });
          },
          onEventText: (line) => {
            emitRuntimeSubagentEvent(pi, { type: "appendLog", runKey: conversationId, chunk: line });
          },
          onStderr: (chunk) => {
            emitRuntimeSubagentEvent(pi, { type: "appendLog", runKey: conversationId, chunk: chunk });
          },
        });
        previousOutput = result.stdout.trim();
        results.push({
          agent: config.name,
          workflow: item.workflow ?? "",
          model: preflight.model,
          warning: preflight.warning || "",
          conversationId,
          code: result.code,
          output: previousOutput,
          stderr: result.stderr.trim(),
          preflight: preflight.report,
        });

        if (result.code !== 0) {
          emitRuntimeSubagentEvent(pi, {
            type: "block",
            runKey: conversationId,
            patch: {
              model: preflight.model,
              summary: `Subagent ${config.name} failed.`,
              outputText: result.stdout.trim() || undefined,
              logs: [result.stderr || result.stdout || "No output"],
            },
          });
          return {
            content: [{ type: "text", text: `${preflight.report}\n\nSubagent ${config.name} failed.\n\n${result.stderr || result.stdout || "No output"}` }],
            details: { results, preflight },
            isError: true,
          };
        }

        emitRuntimeSubagentEvent(pi, {
          type: "complete",
          runKey: conversationId,
          patch: {
            model: preflight.model,
            summary: previousOutput || `Subagent ${config.name} run finished. Checklist-validated task completion is still a board action.`,
            outputText: previousOutput || undefined,
          },
        });
      }

      const lastPreflight = typeof results.at(-1)?.preflight === "string" ? String(results.at(-1)?.preflight) : "";
      return {
        content: [{ type: "text", text: [lastPreflight, previousOutput || "Subagent run finished. Board completion still requires checklist validation."].filter(Boolean).join("\n\n") }],
        details: { results },
      };
    },
  });
}

import type { Api, Model } from "@earendil-works/pi-ai";

export interface AntigravityModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
}

export interface AntigravityOptions {
  executablePath?: string;
  timeoutSeconds?: number;
  logFilePath?: string;
  modelId?: string;
  effort?: "low" | "medium" | "high";
}

export type AntigravityUiEventPhase =
  | "start"
  | "streaming"
  | "thinking"
  | "tool_activity"
  | "plan"
  | "success"
  | "error";

export interface AntigravityUiEvent {
  phase: AntigravityUiEventPhase;
  modelId?: string;
  message?: string;
}

export type AntigravityUiReporter = (event: AntigravityUiEvent) => void;

export interface AntigravityBinaryLinkConfig {
  /** Explicit link to an existing server binary (or ANTIGRAVITY_ACP_BIN). */
  binaryPath?: string;
  /** Harness helper path (or ANTIGRAVITY_ACP_HARNESS). Defaults to sibling. */
  harnessPath?: string;
}

/**
 * Subagent/tool policy: unlimited. The ACP permission handler auto-selects
 * the agent-preferred allow option and the client advertises terminal
 * support, so main-agent turns and spawned subagents can execute tools.
 * This is an explicit user decision — do not add a deny gate here.
 */
export const ANTIGRAVITY_TOOL_POLICY = "unlimited" as const;

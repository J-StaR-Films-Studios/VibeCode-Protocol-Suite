import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";
import type { ChecklistInput } from "./shared";

export type SubagentViewMode = "compact" | "expanded" | "fullscreen";
export type SubagentFocusDirection = "next" | "prev";
export type TakomiSubagentStatus = "running" | "completed" | "blocked";
export type TakomiBoardTaskStatus = "pending" | "in-progress" | "completed" | "blocked";
export type TakomiSubagentSource = "runtime-board" | "takomi-tool";
export const TAKOMI_SUBAGENT_EVENT_CHANNEL = "takomi:subagent-runtime";

export type TakomiSubagentRun = {
  runKey: string;
  conversationId?: string;
  parentTaskId?: string;
  parentRunKey?: string;
  agent: string;
  taskLabel: string;
  status: TakomiSubagentStatus;
  stage?: string;
  workflow?: string;
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  checklist?: ChecklistInput;
  boardTaskStatus?: TakomiBoardTaskStatus;
  summary?: string;
  outputText?: string;
  logs: string[];
  startedAt: number;
  updatedAt: number;
  source: TakomiSubagentSource;
};

export type TakomiSubagentRunInit = Omit<TakomiSubagentRun, "runKey" | "logs" | "startedAt" | "updatedAt" | "status"> & {
  logs?: string[];
  status?: TakomiSubagentStatus;
};

export type TakomiSubagentRunPatch = Partial<Omit<TakomiSubagentRun, "runKey" | "startedAt" | "source">> & {
  source?: TakomiSubagentSource;
};

export type TakomiSubagentRenderEntry = {
  run: TakomiSubagentRun;
  depth: number;
  relation: "focused" | "ancestor" | "peer";
};

export type TakomiSubagentRenderState = {
  mode: SubagentViewMode;
  activeCount: number;
  focusPosition: number;
  focusedRun?: TakomiSubagentRun;
  activePath: TakomiSubagentRenderEntry[];
  peerRuns: TakomiSubagentRenderEntry[];
  compactRuns: TakomiSubagentRenderEntry[];
};

export interface TakomiSubagentController {
  hasRuns(): boolean;
  getViewMode(): SubagentViewMode;
  start(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext, state: TakomiSubagentRunInit, runKey?: string): Promise<void>;
  update(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext, patch: TakomiSubagentRunPatch, runKey?: string): Promise<void>;
  appendLog(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext, chunk: string, runKey?: string): Promise<void>;
  complete(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext, patch?: TakomiSubagentRunPatch, runKey?: string): Promise<void>;
  block(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext, patch?: TakomiSubagentRunPatch, runKey?: string): Promise<void>;
  reset(ctx?: import("@mariozechner/pi-coding-agent").ExtensionContext): void;
  refresh(): void;
  refreshWithContext(ctx: import("@mariozechner/pi-coding-agent").ExtensionContext): void;
  cycleFocus(direction: SubagentFocusDirection, ctx?: import("@mariozechner/pi-coding-agent").ExtensionContext): boolean;
  setViewMode(mode: SubagentViewMode, ctx?: import("@mariozechner/pi-coding-agent").ExtensionContext): SubagentViewMode | undefined;
  cycleViewMode(ctx?: import("@mariozechner/pi-coding-agent").ExtensionContext): SubagentViewMode | undefined;
  closeFullscreen(ctx?: import("@mariozechner/pi-coding-agent").ExtensionContext): SubagentViewMode;
  getKnownParentRunKey(parentTaskId: string): string | undefined;
}

export type TakomiSubagentRuntimeEvent =
  | { type: "start"; runKey?: string; state: TakomiSubagentRunInit }
  | { type: "update"; runKey?: string; patch: TakomiSubagentRunPatch }
  | { type: "appendLog"; runKey?: string; chunk: string }
  | { type: "complete"; runKey?: string; patch?: TakomiSubagentRunPatch }
  | { type: "block"; runKey?: string; patch?: TakomiSubagentRunPatch };

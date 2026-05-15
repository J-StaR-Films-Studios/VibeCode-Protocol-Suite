import type { TakomiThinkingLevel } from "../../../src/pi-takomi-core";

export type TakomiDispatchResult = {
  agent: string;
  task: string;
  workflow?: string;
  model?: string;
  warning?: string;
  thinking?: TakomiThinkingLevel;
  conversationId: string;
  code: number;
  output: string;
  stderr: string;
  preflight: string;
  startedAt?: number;
  endedAt?: number;
  lastActivityAt?: number;
  currentTool?: string;
  currentToolArgs?: string;
  currentToolStartedAt?: number;
  recentTools?: Array<{ tool: string; args: string; endMs: number }>;
  recentOutput?: string[];
  toolCount?: number;
  sessionFile?: string;
};

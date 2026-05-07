// Centralizes Takomi's current pi-subagents internal imports.
// pi-subagents does not yet expose all of these helpers through a stable public API,
// so package.json pins the dependency exactly and this adapter localizes future
// upstream path changes to one file.
export { createSubagentExecutor } from "pi-subagents/src/runs/foreground/subagent-executor";
export type { SubagentParamsLike } from "pi-subagents/src/runs/foreground/subagent-executor";
export { discoverAgents as discoverPiAgents } from "pi-subagents/src/agents/agents";
export type { AgentConfig, AgentScope } from "pi-subagents/src/agents/agents";
export {
  DEFAULT_ARTIFACT_CONFIG,
  TEMP_ARTIFACTS_DIR,
} from "pi-subagents/src/shared/types";
export type {
  Details,
  ExtensionConfig,
  SubagentState,
} from "pi-subagents/src/shared/types";
export { renderSubagentResult, syncResultAnimation } from "pi-subagents/src/tui/render";

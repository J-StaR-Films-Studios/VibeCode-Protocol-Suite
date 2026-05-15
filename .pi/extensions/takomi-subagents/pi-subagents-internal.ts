// Centralizes Takomi's current pi-subagents internal imports.
// pi-subagents ships TS internals rather than a stable public JS API. Import them
// dynamically with computed specifiers so Takomi's own tsc does not type-check
// dependency source, while Pi's runtime TS loader can still load them.

const dynamicImport = new Function("specifier", "return import(specifier)") as <T = any>(specifier: string) => Promise<T>;
const spec = (path: string) => `pi-subagents/${path}.ts`;

export async function loadPiSubagentsInternals() {
  const [executorModule, agentsModule, sharedTypesModule, renderModule] = await Promise.all([
    dynamicImport(spec("src/runs/foreground/subagent-executor")),
    dynamicImport(spec("src/agents/agents")),
    dynamicImport(spec("src/shared/types")),
    dynamicImport(spec("src/tui/render")),
  ]);

  return {
    createSubagentExecutor: executorModule.createSubagentExecutor,
    discoverPiAgents: agentsModule.discoverAgents,
    DEFAULT_ARTIFACT_CONFIG: sharedTypesModule.DEFAULT_ARTIFACT_CONFIG,
    TEMP_ARTIFACTS_DIR: sharedTypesModule.TEMP_ARTIFACTS_DIR,
    renderSubagentResult: renderModule.renderSubagentResult,
    syncResultAnimation: renderModule.syncResultAnimation,
  };
}

export type SubagentParamsLike = any;
export type AgentConfig = any;
export type AgentScope = "user" | "project" | "both";
export type Details = any;
export type ExtensionConfig = any;
export type SubagentState = any;

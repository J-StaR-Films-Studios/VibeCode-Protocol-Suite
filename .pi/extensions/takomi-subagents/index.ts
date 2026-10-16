import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { initializeTakomiAsyncLifecycle, resetTakomiAsyncLifecycle } from "./async-lifecycle";
import {
  clearDetachedResults,
  initializeDetachedSession,
  registerDetachedCompletionNotifications,
} from "./detached-results";
import { renderTakomiSubagentCall, renderTakomiSubagentResult } from "./native-render";
import { loadPiSubagentsInternals } from "./pi-subagents-internal";
import { clearAllTakomiSubagentResultHeartbeats } from "./result-heartbeat";
import { executeTakomiSubagentTool, invalidateTakomiPiSubagentsEngine, type TakomiAcceptanceInput } from "./tool-runner";

const ChecklistItemSchema = Type.Object({
  text: Type.String(),
  done: Type.Optional(Type.Boolean()),
});

const AcceptanceSchema = Type.Unsafe<TakomiAcceptanceInput>({
  anyOf: [
    { type: "string", enum: ["auto", "none", "attested", "checked", "verified", "reviewed"] },
    { type: "boolean", enum: [false] },
    { type: "object", additionalProperties: true },
  ],
  description: "Optional explicit acceptance policy. Omitted Takomi tasks do not enforce acceptance; explicit contracts are forwarded to pi-subagents.",
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
  cwd: Type.Optional(Type.String({ description: "Task working directory. Omit only when this task should inherit the enclosing project cwd. Set it whenever the intended project or directory differs; use an explicit absolute path outside the parent workspace. Relative paths must stay inside their parent, and paths mentioned only in task prose never change cwd." })),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]))),
  requiredCapabilities: Type.Optional(Type.Array(Type.String(), { description: "Capabilities required by the task, such as write-docs or write-code" })),
  acceptance: Type.Optional(AcceptanceSchema),
});

const ContextSchema = Type.Union([
  Type.Literal("fresh"),
  Type.Literal("fork"),
]);

const ActionSchema = Type.Union([
  Type.Literal("list"),
  Type.Literal("get"),
  Type.Literal("models"),
  Type.Literal("status"),
  Type.Literal("interrupt"),
  Type.Literal("resume"),
  Type.Literal("doctor"),
]);

const SubagentParameters = Type.Object({
  action: Type.Optional(ActionSchema),
  agent: Type.Optional(Type.String({ description: "Agent name for single execution, or target agent for get/models actions" })),
  task: Type.Optional(Type.String({ description: "Task for single execution" })),
  workflow: Type.Optional(Type.String({ description: "Workflow or playbook overlay for this task" })),
  skills: Type.Optional(Type.Array(Type.String(), { description: "Extra skills to apply during the task" })),
  model: Type.Optional(Type.String({ description: "Optional per-run model override" })),
  fallbackModels: Type.Optional(Type.Array(Type.String(), { description: "Optional ordered model fallback list" })),
  thinking: Type.Optional(ThinkingSchema),
  conversationId: Type.Optional(Type.String({ description: "Persistent conversation id to resume the same subagent session" })),
  cwd: Type.Optional(Type.String({ description: "Top-level working directory. Omit only when the intended project is the current Pi workspace. Set it whenever the intended project or directory differs; use an explicit absolute path outside the current workspace. Relative paths remain inside the parent workspace, and task prose never changes cwd." })),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]), { description: "Optional checklist for the subagent" })),
  requiredCapabilities: Type.Optional(Type.Array(Type.String(), { description: "Capabilities required by the task, such as write-docs or write-code" })),
  acceptance: Type.Optional(AcceptanceSchema),
  tasks: Type.Optional(Type.Array(TaskSchema, { description: "Parallel subagent tasks" })),
  confirmLaunch: Type.Optional(Type.Boolean({ description: "Required to launch immediately in manual Takomi launch mode" })),
  previewOnly: Type.Optional(Type.Boolean({ description: "Return the delegation plan without launching" })),
  clarify: Type.Optional(Type.Boolean({ description: "Show the native pi-subagents TUI to preview/edit before execution. Especially useful for chains; requires an interactive Pi TUI." })),
  chain: Type.Optional(Type.Array(TaskSchema, { description: "Sequential chain of subagent tasks" })),
  context: Type.Optional(ContextSchema),
  async: Type.Optional(Type.Boolean({ description: "Run through native pi-subagents background/async mode" })),
  concurrency: Type.Optional(Type.Number({ description: "Maximum concurrency for parallel task groups" })),
  worktree: Type.Optional(Type.Boolean({ description: "Use native pi-subagents worktree isolation where supported" })),
  id: Type.Optional(Type.String({ description: "Native async/control run id for status, interrupt, or resume actions" })),
  message: Type.Optional(Type.String({ description: "Follow-up message for resume actions" })),
  index: Type.Optional(Type.Number({ description: "Child index for resume actions when needed" })),
  chainName: Type.Optional(Type.String({ description: "Saved chain name for get actions" })),
  agentScope: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("project"), Type.Literal("both")])),
  // Project-agent confirmation and hard-stop overrides are enforced server-side;
  // they are intentionally not model-callable parameters.
});

function registerSubagentTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "takomi_subagent",
    label: "Takomi",
    description: "Run subagents with Pi-style single, parallel, chain, async, fork, and management/status modes plus Takomi lifecycle metadata.",
    promptSnippet: "Delegate lifecycle-aware Takomi work to specialist subagents. Use single, tasks, chain, or action=list/status/doctor; explicitly set cwd whenever the target differs from the current project; reuse conversationId for review loops.",
    promptGuidelines: [
      "Inside T3 Code, keep following Takomi's personas, routing policy, lifecycle, planning, review, approval, and task-tracking rules, but treat takomi_subagent as inactive for execution. Use the available T3 orchestration tools instead. Outside T3, use takomi_subagent and its execution options below.",
      "In T3, discover capabilities with orchestrator_capabilities and choose tools by their purpose: delegate_task for child work, t3_thread_launch for separate conversations and worktree-bound work, and schedule_task for recurring work. Follow each tool's authorization and workspace rules, including explicit user requests for separate threads and recurring work. Apply Takomi's routing policy to the live T3 provider/model catalog and include the chosen persona and task context in execution prompts. Default to the Takomi harness for spawned agents unless the user explicitly requests another harness. In T3, resolve the Takomi provider instance from orchestrator_capabilities and select it explicitly in the tool's provider selection fields, then choose a model and supported options within that instance using the routing policy. A model provider prefix such as openai-codex/ does not select the Codex CLI harness. A model-only request keeps the Takomi harness; if that model cannot run there, explain and ask before switching harnesses. Routing preferences are defaults, not a closed list: honor explicit user requests for a model, provider, harness, or effort level even when the policy does not mention them. Verify availability and support in the current catalog or registry; if unavailable, explain rather than silently substitute. Explicit allowlists and approval requirements still apply.",
      "Track T3 task, thread, and schedule IDs with Takomi's task records. Use T3's status, cancellation, and completion tools. For uncertain launches, resolve the existing run and reuse its clientRequestId where supported rather than launching duplicate work or falling back to Takomi execution.",
      "Use action=list to discover agents, action=get/models to inspect persona routing, and action=status/doctor for native pi-subagents diagnostics/control instead of raw subagent.",
      "Use tasks for independent parallel work and chain for dependent handoffs with {previous}.",
      "Set context=fork only when inherited parent-session history is needed; otherwise prefer fresh or the agent default.",
      "Set async=true for long-running work when the parent can continue safely; keep active worktree writes single-threaded unless worktree isolation is enabled.",
      "Set clarify=true when the user asks to preview/edit a subagent run in the native Pi TUI before launch.",
      "Use only Takomi's canonical personas: architect, designer, coder, worker, reviewer, and orchestrator.",
      "Set requiredCapabilities for artifact-producing tasks; use requiredCapabilities=[] for explicitly read-only work. The runtime blocks inspection-only personas from write-required work.",
      "Omit cwd only when the intended project is the current/default project. Always set cwd when a task targets another project or directory; use an explicit absolute cwd outside the parent workspace, and a contained relative cwd only inside it. A path mentioned only in task prose never changes launch cwd.",
      "Read validation failures as correction feedback: inspect reason, resolved cwd, and resolved capabilities before proposing a corrected call.",
      "Deliberately choose an exact provider-qualified model from the current user instruction, routing policy, and active registry for normal subagent dispatch. Omit model only when intentionally choosing the Pi/harness default; never treat a role fallback as a restriction.",
      "When the user requests a named model and its exact provider-qualified ID appears in the active registry context or action=models output, pass that model explicitly instead of declining or silently using a role default. A strict allowlist applies only when approvedModels is explicitly configured.",
      "If review sends work back to the same agent, reuse the same conversationId for continuity.",
      "If a launch is blocked, cancelled, paused, or review-gated, do not retry automatically; wait for the user's next prompt."
    ],
    parameters: SubagentParameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return executeTakomiSubagentTool(pi, params, signal, onUpdate as any, ctx);
    },
    renderCall: renderTakomiSubagentCall,
    renderResult: renderTakomiSubagentResult,
  });
}

export default async function takomiSubagents(pi: ExtensionAPI) {
  // Preload the native pi-subagents renderer before tool registration. Rendering
  // callbacks are synchronous, so if we only lazy-load internals during execution
  // a completed takomi_subagent result can fall back to Takomi's plain text
  // renderer and lose the native compact/expanded details shown by `subagent`.
  let cleanupAsyncLifecycle: () => void;
  try {
    await loadPiSubagentsInternals();
    // A same-process Takomi reload reuses the ExtensionAPI identity, so explicitly
    // discard the cached engine before replacing its lifecycle generation.
    invalidateTakomiPiSubagentsEngine(pi);
    cleanupAsyncLifecycle = await initializeTakomiAsyncLifecycle(pi);
  } catch (error) {
    // Optional subagents must not prevent Pi from starting. Do not register a
    // tool or session lifecycle hooks backed by an unavailable runtime.
    const reason = error instanceof Error ? error.message : String(error);
    const warning = `Takomi subagents disabled for this session: ${reason}. Fix the error and reload to retry.`;
    pi.on("session_start", (_event, ctx) => {
      if (ctx.hasUI) ctx.ui.notify(warning, "warning");
      else console.warn(warning);
    });
    return;
  }
  registerSubagentTool(pi);

  // Replace native completion notification through pi-subagents' own reload-safe
  // registration slot. The shared renderer and dedupe key remain authoritative;
  // Takomi enriches the single native notice without adding polling or timers.
  const unregisterCompletionNotifications = registerDetachedCompletionNotifications(pi);

  // Tool rows normally settle and clear their own heartbeat. A turn can also end
  // without Pi rendering a final result (for example, after an abnormal tool
  // interruption), so clear abandoned rows and rehydrate only authenticated
  // launch provenance from the replacement session's own custom entries.
  pi.on("agent_end", () => clearAllTakomiSubagentResultHeartbeats());
  pi.on("session_start", async (_event, ctx) => {
    clearAllTakomiSubagentResultHeartbeats();
    await resetTakomiAsyncLifecycle(pi, ctx);
    await initializeDetachedSession(pi, ctx);
  });
  pi.on("session_shutdown", () => {
    clearAllTakomiSubagentResultHeartbeats();
    clearDetachedResults(pi);
    invalidateTakomiPiSubagentsEngine(pi);
    cleanupAsyncLifecycle();
    unregisterCompletionNotifications();
  });
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { StringEnum } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import {
  createSessionId,
  createTask,
  decideRoute,
  getSessionPaths,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  moveTaskStatus,
  renderMasterPlan,
  renderTaskFile,
  type OrchestratorTask,
  type TakomiRole,
  type TakomiWorkflowId,
  type VibeLifecycleStage,
} from "../../../src/pi-takomi-core";

type TakomiState = {
  enabled: boolean;
  autoOrch: boolean;
  planMode: boolean;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  activeSessionId?: string;
};

const DEFAULT_STATE: TakomiState = {
  enabled: true,
  autoOrch: false,
  planMode: false,
  role: "general",
};

const STATE_ENTRY = "takomi-runtime-state";

function cloneState(state: TakomiState): TakomiState {
  return { ...state };
}

function formatState(state: TakomiState): string {
  return [
    `Takomi ${state.enabled ? "on" : "off"}`,
    `role=${state.role}`,
    `stage=${state.stage ?? "-"}`,
    `workflow=${state.workflow ?? "-"}`,
    `autoOrch=${state.autoOrch ? "on" : "off"}`,
    `plan=${state.planMode ? "on" : "off"}`,
    state.activeSessionId ? `session=${state.activeSessionId}` : "",
  ].filter(Boolean).join(" | ");
}

function setStageAndWorkflow(state: TakomiState, stage: VibeLifecycleStage) {
  state.stage = stage;
  state.workflow = stage === "genesis" ? "vibe-genesis" : stage === "design" ? "vibe-design" : "vibe-build";
  state.role = stage === "design" ? "design" : stage === "build" ? "orchestrator" : "architect";
  state.enabled = true;
}

function rolePrompt(role: TakomiRole): string {
  switch (role) {
    case "orchestrator":
      return [
        "You are operating in Takomi orchestrator mode.",
        "Break work into tasks, delegate with specialist agents, review outputs, and route revisions intelligently.",
        "When a task needs more work, you may send it back to the same agent using the same conversation continuity if that is most efficient.",
      ].join("\n");
    case "architect":
      return [
        "You are operating in Takomi architect mode.",
        "Clarify scope, define acceptance criteria, and build the project foundation before design or implementation.",
      ].join("\n");
    case "design":
      return [
        "You are operating in Takomi design mode.",
        "Translate genesis context into build-ready UX and visual direction.",
        "Prefer Gemini or a similarly strong design-oriented model if available.",
      ].join("\n");
    case "code":
      return [
        "You are operating in Takomi code mode.",
        "Implement directly, keep scope controlled, and verify after changes.",
      ].join("\n");
    case "review":
      return [
        "You are operating in Takomi review mode.",
        "Focus on correctness, risk, omissions, and actionable review feedback.",
      ].join("\n");
    default:
      return [
        "You are operating in Takomi general mode.",
        "Choose the correct lifecycle stage and specialist behavior based on the request.",
      ].join("\n");
  }
}

function planPrompt(): string {
  return [
    "Takomi planning mode is active.",
    "Before major implementation, produce a short numbered plan.",
    "If the request is broad, explicitly identify whether the user is in genesis, design, or build.",
  ].join("\n");
}

function getInjectedPlaybook(state: TakomiState): string | undefined {
  if (!state.workflow) return undefined;
  const workflow = getWorkflowDefinition(state.workflow);
  return [
    `${workflow.title} is the active Takomi workflow.`,
    workflow.purpose,
    workflow.preferredModelHint ?? "",
    workflow.playbook,
    workflow.nextStage ? `After this stage, recommend ${workflow.nextStage}.` : "",
  ].filter(Boolean).join("\n\n");
}

function shouldAutoRoute(text: string): boolean {
  const lowered = text.toLowerCase();
  const broadSignal = ["use takomi", "orchestrate", "plan and build", "full workflow", "break this down", "coordinate"].some((signal) => lowered.includes(signal));
  const multiClause = (lowered.match(/\b(and|then|also|after|while)\b/g) ?? []).length >= 2;
  return broadSignal || (lowered.length > 220 && multiClause);
}

function buildTaskRows(tasks: OrchestratorTask[]): string {
  return tasks.map((task) => `${task.id}: ${task.title} [${task.status}] -> ${task.preferredAgent ?? task.role}${task.conversationId ? ` (${task.conversationId})` : ""}`).join("\n");
}

async function writeOrchestratorSession(cwd: string, sessionId: string, title: string, tasks: OrchestratorTask[]) {
  const paths = getSessionPaths(cwd, sessionId);
  await mkdir(paths.pending, { recursive: true });
  await mkdir(paths.inProgress, { recursive: true });
  await mkdir(paths.completed, { recursive: true });
  await writeFile(paths.masterPlan, renderMasterPlan(sessionId, title, tasks), "utf8");

  for (const task of tasks) {
    const filePath = path.join(paths.pending, `${task.id}_${task.title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.task.md`);
    await writeFile(filePath, renderTaskFile(task, `Parent session: ${sessionId}\n\nTask title: ${task.title}`), "utf8");
  }

  return paths;
}

async function refreshUi(ctx: ExtensionContext, state: TakomiState) {
  if (!ctx.hasUI) return;
  ctx.ui.setStatus("takomi-runtime", ctx.ui.theme.fg("accent", `⚙ ${state.stage ?? state.role}${state.autoOrch ? " • auto" : ""}${state.planMode ? " • plan" : ""}`));
  ctx.ui.setWidget("takomi-runtime", [
    ctx.ui.theme.fg("muted", "Takomi Runtime"),
    `enabled: ${state.enabled ? "yes" : "no"}`,
    `role: ${state.role}`,
    `stage: ${state.stage ?? "-"}`,
    `workflow: ${state.workflow ?? "-"}`,
    `auto-orch: ${state.autoOrch ? "on" : "off"}`,
    `plan: ${state.planMode ? "on" : "off"}`,
    `session: ${state.activeSessionId ?? "-"}`,
  ]);
}

export default function takomiRuntime(pi: ExtensionAPI) {
  let state = cloneState(DEFAULT_STATE);

  function persistState() {
    pi.appendEntry(STATE_ENTRY, state);
  }

  async function updateState(ctx: ExtensionContext, mutator: () => void, message?: string) {
    mutator();
    persistState();
    await refreshUi(ctx, state);
    if (message) ctx.ui.notify(message, "info");
  }

  pi.registerCommand("takomi", {
    description: "Enable Takomi runtime guidance for this session",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
      }, formatState(state));
    },
  });

  pi.registerCommand("orch", {
    description: "Bias the session toward Takomi orchestrator behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "orchestrator";
        state.stage = "build";
        state.workflow = "vibe-build";
      }, "Takomi role set to orchestrator");
    },
  });

  pi.registerCommand("architect", {
    description: "Bias the session toward Takomi architect behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "architect";
      }, "Takomi role set to architect");
    },
  });

  pi.registerCommand("code", {
    description: "Bias the session toward Takomi code behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "code";
      }, "Takomi role set to code");
    },
  });

  pi.registerCommand("review", {
    description: "Bias the session toward Takomi review behavior",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.role = "review";
      }, "Takomi role set to review");
    },
  });

  pi.registerCommand("takomi-genesis", {
    description: "Activate the Takomi genesis stage",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => setStageAndWorkflow(state, "genesis"), "Takomi stage set to Vibe Genesis");
    },
  });

  pi.registerCommand("takomi-design", {
    description: "Activate the Takomi design stage",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => setStageAndWorkflow(state, "design"), "Takomi stage set to Vibe Design");
    },
  });

  pi.registerCommand("takomi-build", {
    description: "Activate the Takomi build stage",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => setStageAndWorkflow(state, "build"), "Takomi stage set to Vibe Build");
    },
  });

  pi.registerCommand("takomi-lifecycle", {
    description: "Show the embedded Takomi lifecycle playbooks",
    handler: async (_args, ctx) => {
      const lines = listWorkflowDefinitions().map((workflow) => `${workflow.id} — ${workflow.purpose}${workflow.preferredModelHint ? ` (${workflow.preferredModelHint})` : ""}`);
      ctx.ui.notify(lines.join("\n\n"), "info");
    },
  });

  pi.registerCommand("takomi-kickoff", {
    description: "Create a default Genesis → Design → Build orchestrator session",
    handler: async (args, ctx) => {
      const title = args.trim() || "Takomi Project";
      const sessionId = createSessionId();
      const tasks = [
        createTask("01", "Genesis foundation", "architect", { workflow: "vibe-genesis", preferredAgent: "architect" }),
        createTask("02", "Design handoff", "design", { workflow: "vibe-design", preferredAgent: "designer", preferredModelHint: "Prefer Gemini or another design-capable cloud model." }),
        createTask("03", "Build orchestration", "orchestrator", { workflow: "vibe-build", preferredAgent: "orchestrator" }),
      ];
      const paths = await writeOrchestratorSession(ctx.cwd, sessionId, title, tasks);
      await updateState(ctx, () => {
        state.activeSessionId = sessionId;
        state.stage = "build";
        state.workflow = "vibe-build";
        state.role = "orchestrator";
      }, `Takomi kickoff created session ${sessionId}`);
      ctx.ui.notify(`Master plan: ${paths.masterPlan}`, "info");
    },
  });

  pi.registerCommand("autoorch", {
    description: "Toggle lightweight automatic orchestration routing",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.autoOrch = !state.autoOrch;
      }, `Takomi auto-orchestrator ${state.autoOrch ? "enabled" : "disabled"}`);
    },
  });

  pi.registerCommand("takomi-plan", {
    description: "Toggle lightweight Takomi planning bias",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state.enabled = true;
        state.planMode = !state.planMode;
      }, `Takomi plan mode ${state.planMode ? "enabled" : "disabled"}`);
    },
  });

  pi.registerCommand("takomi-reset", {
    description: "Reset Takomi runtime state to defaults",
    handler: async (_args, ctx) => {
      await updateState(ctx, () => {
        state = cloneState(DEFAULT_STATE);
      }, "Takomi runtime state reset");
    },
  });

  pi.registerTool({
    name: "takomi_workflow",
    label: "Takomi Workflow",
    description: "Return embedded Takomi workflow playbooks for genesis, design, and build.",
    promptSnippet: "Get embedded Takomi lifecycle playbooks without relying on external skill files.",
    parameters: Type.Object({
      workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
    }),
    async execute(_toolCallId, params) {
      if (params.workflow) {
        const workflow = getWorkflowDefinition(params.workflow);
        return {
          content: [{ type: "text", text: `${workflow.title}\n\n${workflow.playbook}` }],
          details: workflow,
        };
      }

      const workflows = listWorkflowDefinitions();
      return {
        content: [{ type: "text", text: workflows.map((workflow) => `${workflow.id}: ${workflow.purpose}`).join("\n") }],
        details: { workflows },
      };
    },
  });

  pi.registerTool({
    name: "takomi_board",
    label: "Takomi Board",
    description: "Create and manage lightweight Takomi orchestrator session artifacts.",
    promptSnippet: "Create an orchestrator session board and task files for Vibe Build.",
    promptGuidelines: [
      "Use this when you need a concrete orchestrator session directory and task artifacts on disk.",
      "If a reviewed task needs more work, keep or reuse its conversationId so the same subagent can continue it.",
    ],
    parameters: Type.Object({
      action: StringEnum(["init_session", "show_workflows", "show_session"] as const),
      title: Type.Optional(Type.String()),
      sessionId: Type.Optional(Type.String()),
      tasks: Type.Optional(Type.Array(Type.Object({
        id: Type.String(),
        title: Type.String(),
        role: StringEnum(["general", "orchestrator", "architect", "design", "code", "review"] as const),
        workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
        preferredAgent: Type.Optional(Type.String()),
        preferredModelHint: Type.Optional(Type.String()),
      }))),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (params.action === "show_workflows") {
        const workflows = listWorkflowDefinitions();
        return {
          content: [{ type: "text", text: workflows.map((workflow) => `${workflow.id}: ${workflow.playbook}`).join("\n\n") }],
          details: { workflows },
        };
      }

      if (params.action === "show_session") {
        if (!params.sessionId) {
          return { content: [{ type: "text", text: "sessionId is required for show_session" }], details: {}, isError: true };
        }
        const paths = getSessionPaths(ctx.cwd, params.sessionId);
        const masterPlan = await readFile(paths.masterPlan, "utf8").catch(() => "Master plan not found.");
        return {
          content: [{ type: "text", text: masterPlan }],
          details: { paths },
        };
      }

      const sessionId = params.sessionId || createSessionId();
      const title = params.title || "Takomi Build Session";
      const tasks = (params.tasks ?? []).map((task) => createTask(task.id, task.title, task.role, {
        workflow: task.workflow,
        preferredAgent: task.preferredAgent,
        preferredModelHint: task.preferredModelHint,
      }));
      const paths = await writeOrchestratorSession(ctx.cwd, sessionId, title, tasks);
      state.activeSessionId = sessionId;
      persistState();

      return {
        content: [{ type: "text", text: `Created Takomi orchestrator session ${sessionId}\n\n${buildTaskRows(tasks) || "No tasks provided."}` }],
        details: { sessionId, paths, tasks },
      };
    },
  });

  pi.on("input", async (event) => {
    if (event.source === "extension") return { action: "continue" };

    const text = event.text.trim();
    const lowered = text.toLowerCase();

    if (lowered === "use takomi") {
      state.enabled = true;
      return { action: "transform", text: "Use the Takomi runtime, identify the correct lifecycle stage, and proceed accordingly." };
    }

    if (lowered.startsWith("use takomi ")) {
      state.enabled = true;
      const route = decideRoute(text.slice("use takomi ".length));
      if (route.stage) setStageAndWorkflow(state, route.stage);
      else if (route.role !== "general") state.role = route.role;
      return { action: "transform", text: `Use the Takomi runtime for this request: ${text.slice("use takomi ".length)}` };
    }

    if (/\bvibe genesis\b/i.test(text)) {
      setStageAndWorkflow(state, "genesis");
      return { action: "transform", text };
    }
    if (/\bvibe design\b/i.test(text)) {
      setStageAndWorkflow(state, "design");
      return { action: "transform", text };
    }
    if (/\bvibe build\b/i.test(text)) {
      setStageAndWorkflow(state, "build");
      return { action: "transform", text };
    }

    return { action: "continue" };
  });

  pi.on("before_agent_start", async (event) => {
    if (!state.enabled) return;

    let effectiveState = cloneState(state);
    if (state.autoOrch && shouldAutoRoute(event.prompt)) {
      effectiveState.role = "orchestrator";
      effectiveState.stage = "build";
      effectiveState.workflow = "vibe-build";
    }

    const route = decideRoute(event.prompt);
    if (!effectiveState.stage && route.stage) {
      effectiveState.stage = route.stage;
      effectiveState.workflow = route.workflow;
      effectiveState.role = route.role;
    }

    const parts = [
      "Takomi runtime is active for this turn.",
      rolePrompt(effectiveState.role),
      effectiveState.planMode ? planPrompt() : "",
      getInjectedPlaybook(effectiveState),
      `Routing note: ${route.reason}`,
      "When useful, state the current Takomi stage and the recommended next stage.",
      effectiveState.stage === "build"
        ? "For build orchestration, it is valid to dispatch tasks to specialist subagents, review them, and send fixes back to the same agent by reusing its conversation id."
        : "",
    ].filter(Boolean);

    return {
      systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as { type: string; customType?: string; data?: TakomiState };
      if (entry.type === "custom" && entry.customType === STATE_ENTRY && entry.data) {
        state = { ...DEFAULT_STATE, ...entry.data };
        break;
      }
    }

    await refreshUi(ctx, state);
  });
}

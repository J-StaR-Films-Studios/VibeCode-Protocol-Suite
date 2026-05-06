import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type {
  TakomiLaunchMode,
  TakomiRole,
  TakomiWorkflowId,
  VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import { commandHelp, completions, statusText, workflowPrompt } from "./command-text";
import type { TakomiSubagentController } from "./subagent-types";

export type TakomiRuntimeCommandState = {
  enabled: boolean;
  autoOrch: boolean;
  launchMode: TakomiLaunchMode;
  planMode: boolean;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  activeSessionId?: string;
  subagentsEnabled: boolean;
};

type RegisterTakomiCommandOptions = {
  getState(): TakomiRuntimeCommandState;
  updateState(ctx: ExtensionContext, mutator: () => void, message?: string | (() => string)): Promise<void>;
  resetRuntime(ctx: ExtensionCommandContext): Promise<void>;
  setStageAndWorkflow(stage: VibeLifecycleStage, options?: { preserveRole?: boolean }): void;
  createPlanSession(ctx: ExtensionCommandContext, title?: string): Promise<string>;
  hasGenesisArtifacts(cwd: string): Promise<boolean>;
  subagentController: TakomiSubagentController;
};

export function registerTakomiCommands(pi: ExtensionAPI, options: RegisterTakomiCommandOptions): void {
  async function handleStage(ctx: ExtensionCommandContext, stage: VibeLifecycleStage, prompt?: string): Promise<void> {
    await options.updateState(ctx, () => {
      options.getState().enabled = true;
      options.setStageAndWorkflow(stage, { preserveRole: stage === "genesis" && options.getState().role === "orchestrator" });
      options.getState().planMode = stage !== "build";
    }, workflowPrompt(stage, prompt));
  }

  async function handleMode(ctx: ExtensionCommandContext, mode?: string): Promise<void> {
    if (mode !== "direct" && mode !== "orchestrate" && mode !== "review") {
      ctx.ui.notify("Usage: /takomi mode <direct|orchestrate|review>", "warning");
      return;
    }
    const hasGenesis = await options.hasGenesisArtifacts(ctx.cwd);
    await options.updateState(ctx, () => {
      const state = options.getState();
      state.enabled = true;
      if (mode === "direct") {
        state.autoOrch = false;
        state.planMode = false;
        state.role = "general";
      } else if (mode === "orchestrate") {
        state.autoOrch = true;
        state.planMode = true;
        state.role = "orchestrator";
        state.stage = hasGenesis ? "build" : "genesis";
        state.workflow = hasGenesis ? "vibe-build" : "vibe-genesis";
      } else {
        state.autoOrch = false;
        state.planMode = true;
        state.launchMode = "manual";
        state.role = "review";
      }
    }, () => `Takomi mode set to ${mode}`);
  }

  async function handleGate(ctx: ExtensionCommandContext, gate?: string): Promise<void> {
    if (gate !== "auto" && gate !== "review") {
      ctx.ui.notify("Usage: /takomi gate <auto|review>", "warning");
      return;
    }
    await options.updateState(ctx, () => {
      const state = options.getState();
      state.enabled = true;
      state.launchMode = gate === "review" ? "manual" : "auto";
      state.autoOrch = gate === "auto";
    }, () => `Takomi execution gate set to ${gate}`);
  }

  async function handleSubagents(ctx: ExtensionCommandContext, action?: string): Promise<void> {
    const controller = options.subagentController;
    const nativeViewActions = new Set(["expand", "collapse", "fullscreen", "next", "prev", "toggle"]);
    if (action === "on" || action === "off") {
      await options.updateState(ctx, () => {
        options.getState().subagentsEnabled = action === "on";
      }, `Takomi subagents ${action}`);
      return;
    }
    if (action === "status" || !action) {
      ctx.ui.notify(statusText(options.getState(), controller), controller.hasRuns() ? "info" : "warning");
      return;
    }
    if (action && nativeViewActions.has(action)) {
      ctx.ui.notify("Takomi now uses Pi's native subagent result UI. Use Ctrl+O on a subagent result to expand it.", "info");
      return;
    }
    ctx.ui.notify("Usage: /takomi subagents <on|off|status>", "warning");
  }

  pi.registerCommand("takomi", {
    description: "Takomi lifecycle entrypoint",
    getArgumentCompletions: completions,
    handler: async (args, ctx) => {
      const [subcommand = "", ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const tail = rest.join(" ");
      if (!subcommand) {
        await options.updateState(ctx, () => {
          options.getState().enabled = true;
        }, commandHelp());
        return;
      }
      if (subcommand === "genesis") return handleStage(ctx, "genesis", tail);
      if (subcommand === "design") return handleStage(ctx, "design", tail);
      if (subcommand === "build") return handleStage(ctx, "build", tail);
      if (subcommand === "plan" || subcommand === "kickoff" || subcommand === "lifecycle" || subcommand === "autoorch") {
        const summary = await options.createPlanSession(ctx, tail || undefined);
        ctx.ui.notify(summary, "info");
        return;
      }
      if (subcommand === "mode") return handleMode(ctx, rest[0]);
      if (subcommand === "gate") return handleGate(ctx, rest[0]);
      if (subcommand === "subagents" || subcommand === "subagent") return handleSubagents(ctx, rest[0]);
      if (subcommand === "status") {
        ctx.ui.notify(statusText(options.getState(), options.subagentController), "info");
        return;
      }
      if (subcommand === "reset") return options.resetRuntime(ctx);
      ctx.ui.notify(commandHelp(), "warning");
    },
  });

  pi.registerCommand("takomi-status", {
    description: "Show Takomi lifecycle, gate, session, and subagent status",
    handler: async (_args, ctx) => {
      ctx.ui.notify(statusText(options.getState(), options.subagentController), "info");
    },
  });

  pi.registerCommand("takomi-reset", {
    description: "Reset Takomi runtime state to defaults",
    handler: async (_args, ctx) => {
      await options.resetRuntime(ctx);
    },
  });
}

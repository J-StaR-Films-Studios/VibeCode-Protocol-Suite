import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type {
  TakomiLaunchMode,
  TakomiRole,
  TakomiWorkflowId,
  VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import { commandHelp, completions, statusText, workflowPrompt } from "./command-text";
import type { TakomiSubagentController } from "./subagent-types";
import { installTakomiRoutingPolicy, resolveTakomiRoutingPolicy, type RoutingPolicyInstallScope } from "./routing-policy";
import { collectTakomiStats, renderTakomiStats } from "../../../src/takomi-stats.js";

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

  async function handleRouting(ctx: ExtensionCommandContext, body?: string): Promise<void> {
    const trimmed = body?.trim() ?? "";

    const usage = [
      "Usage:",
      "/takomi routing show                 Print the full active policy",
      "/takomi routing where                Show source/path only",
      "/takomi routing <policy text>        Update the global policy",
      "/takomi routing local <policy text>  Create/update this project's override",
    ].join("\n");

    async function showRoutingHelp(): Promise<void> {
      const resolved = await resolveTakomiRoutingPolicy(ctx.cwd);
      ctx.ui.notify([
        "Takomi routing options",
        "",
        `Active source: ${resolved.source}`,
        `Active path: ${resolved.policyPath ?? "not found"}`,
        "",
        usage,
        "",
        "Resolution order: project .pi/takomi/model-routing.md → global ~/.pi/takomi/model-routing.md → bundled fallback.",
      ].join("\n"), "warning");
    }

    async function showRoutingLocation(): Promise<void> {
      const resolved = await resolveTakomiRoutingPolicy(ctx.cwd);
      ctx.ui.notify([
        "Active Takomi routing policy location",
        "",
        `Source: ${resolved.source}`,
        `Path: ${resolved.policyPath ?? "not found"}`,
        "",
        usage,
      ].join("\n"), resolved.source === "missing" ? "warning" : "info");
    }

    async function showActivePolicy(): Promise<void> {
      const resolved = await resolveTakomiRoutingPolicy(ctx.cwd);
      const text = resolved.text ?? "No Takomi routing policy found.";
      const clipped = text.length > 6000 ? `${text.slice(0, 6000)}\n\n…truncated; open the file above for the full policy.` : text;
      ctx.ui.notify([
        "Active Takomi routing policy",
        "",
        `Source: ${resolved.source}`,
        `Path: ${resolved.policyPath ?? "not found"}`,
        "",
        clipped,
        "",
        usage,
      ].join("\n"), resolved.source === "missing" ? "warning" : "info");
    }

    if (!trimmed) {
      await showRoutingHelp();
      return;
    }
    if (/^(where|path|status)$/i.test(trimmed)) {
      await showRoutingLocation();
      return;
    }
    if (/^(show|view)$/i.test(trimmed)) {
      await showActivePolicy();
      return;
    }

    if (/^(global|local|project|set)$/i.test(trimmed)) {
      ctx.ui.notify(usage, "warning");
      return;
    }

    const scopeMatch = trimmed.match(/^(global|local|project)\s+([\s\S]+)$/i);
    const scope: RoutingPolicyInstallScope = scopeMatch?.[1]?.toLowerCase() === "local" || scopeMatch?.[1]?.toLowerCase() === "project" ? "project" : "global";
    const policyText = scopeMatch?.[2] ?? trimmed.replace(/^set\s+/i, "");

    try {
      const result = await installTakomiRoutingPolicy(ctx.cwd, policyText, { scope });
      const detected = result.detectedDefaults.length ? `\n\nDetected defaults:\n- ${result.detectedDefaults.join("\n- ")}` : "\n\nNo model names were auto-detected; saved policy only.";
      const overrideNote = scope === "global"
        ? "\n\nThis will be used by every project unless that project has its own .pi/takomi/model-routing.md override."
        : "\n\nThis project-local policy overrides the global policy for the current project.";
      ctx.ui.notify(`Takomi routing policy updated (${scope}).\n\nPolicy: ${result.policyPath}\nSettings: ${result.settingsPath}${detected}${overrideNote}`, "info");
    } catch (error) {
      ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
    }
  }

  async function handleSubagents(ctx: ExtensionCommandContext, action?: string): Promise<void> {
    const controller = options.subagentController;
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
    if (action === "expand" || action === "fullscreen") {
      ctx.ui.setToolsExpanded(true);
      ctx.ui.notify("Expanded native tool results for Takomi subagent output.", "info");
      return;
    }
    if (action === "collapse") {
      ctx.ui.setToolsExpanded(false);
      ctx.ui.notify("Collapsed native tool results.", "info");
      return;
    }
    if (action === "toggle") {
      const expanded = !ctx.ui.getToolsExpanded();
      ctx.ui.setToolsExpanded(expanded);
      ctx.ui.notify(`${expanded ? "Expanded" : "Collapsed"} native tool results.`, "info");
      return;
    }
    if (action === "next" || action === "prev") {
      ctx.ui.notify("Takomi now uses Pi's native inline result UI. Subagent navigation is handled by the transcript/tool results.", "info");
      return;
    }
    ctx.ui.notify("Usage: /takomi subagents <on|off|status|expand|collapse|toggle>", "warning");
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
      if (subcommand === "routing" || subcommand === "route" || subcommand === "models") return handleRouting(ctx, tail);
      if (subcommand === "subagents" || subcommand === "subagent") return handleSubagents(ctx, rest[0]);
      if (subcommand === "stats") {
        try {
          const stats = await collectTakomiStats({ cwd: ctx.cwd });
          ctx.ui.notify(renderTakomiStats(stats, { limit: 8 }), "info");
        } catch (error) {
          ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
        }
        return;
      }
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

  pi.registerCommand("takomi-stats", {
    description: "Show bundled Takomi/Pi token, model, project, and subagent usage stats",
    handler: async (_args, ctx) => {
      try {
        const stats = await collectTakomiStats({ cwd: ctx.cwd });
        ctx.ui.notify(renderTakomiStats(stats, { limit: 8 }), "info");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });

  pi.registerCommand("takomi-reset", {
    description: "Reset Takomi runtime state to defaults",
    handler: async (_args, ctx) => {
      await options.resetRuntime(ctx);
    },
  });
}

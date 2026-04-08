import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@mariozechner/pi-coding-agent";
import {
  ellipsizeMiddle,
  formatFooterNumber,
  truncateToWidth,
  visibleWidth,
} from "./shared";

interface Component {
  render(width: number): string[];
  invalidate(): void;
  dispose?(): void;
}

interface RenderTui {
  requestRender(force?: boolean): void;
}

export type RuntimeHudState = {
  enabled: boolean;
  autoOrch: boolean;
  planMode: boolean;
  role: string;
  stage?: string;
  workflow?: string;
  activeSessionId?: string;
};

type Tone = "accent" | "warning" | "success" | "error" | "muted" | "dim" | "thinkingMinimal";

function stageTone(stage?: string): Tone {
  switch (stage) {
    case "genesis":
      return "thinkingMinimal";
    case "design":
      return "accent";
    case "build":
      return "warning";
    default:
      return "muted";
  }
}

function badge(theme: Theme, label: string, tone: Tone): string {
  return theme.fg(tone, `<${label.toUpperCase()}>`);
}

export function renderRuntimeStatus(theme: Theme, state: RuntimeHudState): string {
  const primary = state.stage ?? state.role;
  const stageBadge = badge(theme, primary, stageTone(state.stage));
  const auto = state.autoOrch ? theme.fg("accent", "auto") : theme.fg("dim", "manual");
  const plan = state.planMode ? theme.fg("warning", "plan") : theme.fg("dim", "direct");
  return [theme.fg("accent", "Takomi"), stageBadge, theme.fg("dim", `role:${state.role}`), auto, plan].join(" ");
}

export function renderRuntimeWidget(theme: Theme, state: RuntimeHudState): string[] {
  if (!state.enabled) return [];
  const primary = state.stage ?? state.role;
  const parts = [
    theme.fg("accent", "Takomi"),
    badge(theme, primary, stageTone(state.stage)),
    theme.fg("dim", `role:${state.role}`),
    state.autoOrch ? theme.fg("accent", "auto") : theme.fg("dim", "manual"),
    state.planMode ? theme.fg("warning", "plan") : theme.fg("dim", "direct"),
    state.workflow ? theme.fg("dim", `wf:${state.workflow}`) : "",
    state.activeSessionId ? theme.fg("dim", `session:${ellipsizeMiddle(state.activeSessionId, 12)}`) : "",
  ].filter(Boolean);
  return [parts.join("  ")];
}

export class TakomiFooterComponent implements Component {
  private readonly unsubscribeBranchChange: () => void;

  constructor(
    private readonly tui: RenderTui,
    private readonly theme: Theme,
    private readonly footerData: ReadonlyFooterDataProvider,
    private readonly ctx: ExtensionContext,
    private readonly getState: () => RuntimeHudState,
  ) {
    this.unsubscribeBranchChange = footerData.onBranchChange(() => {
      this.tui.requestRender();
    });
  }

  dispose(): void {
    this.unsubscribeBranchChange();
  }

  invalidate(): void {}

  render(width: number): string[] {
    const state = this.getState();
    let input = 0;
    let output = 0;
    let cost = 0;

    for (const entry of this.ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "assistant") {
        const message = entry.message as AssistantMessage;
        input += message.usage.input;
        output += message.usage.output;
        cost += message.usage.cost.total;
      }
    }

    const cwd = this.theme.fg("dim", this.ctx.cwd);
    const stats = this.theme.fg("dim", `up:${formatFooterNumber(input)} down:${formatFooterNumber(output)} $${cost.toFixed(3)}`);
    const leftPad = " ".repeat(Math.max(1, width - visibleWidth(cwd) - visibleWidth(stats)));
    const topLine = truncateToWidth(`${cwd}${leftPad}${stats}`, width);

    const extensionStatuses = [...this.footerData.getExtensionStatuses().entries()]
      .filter(([key]) => key !== "takomi-runtime")
      .map(([, value]) => value)
      .filter(Boolean);
    const runtimeStatus = renderRuntimeStatus(this.theme, state);
    const left = [runtimeStatus, ...extensionStatuses].join(this.theme.fg("dim", "  |  "));
    const branch = this.footerData.getGitBranch();
    const rightText = [this.ctx.model?.id || "no-model", branch ? `git:${branch}` : ""].filter(Boolean).join(" | ");
    const right = this.theme.fg("dim", rightText);
    const rightPad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
    const bottomLine = truncateToWidth(`${left}${rightPad}${right}`, width);

    return [topLine, bottomLine];
  }
}

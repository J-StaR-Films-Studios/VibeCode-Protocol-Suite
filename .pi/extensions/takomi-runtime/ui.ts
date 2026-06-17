import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@earendil-works/pi-coding-agent";
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
  launchMode?: string;
  subagentsEnabled?: boolean;
  modeSource?: "idle" | "manual" | "model" | "board";
  modeReason?: string;
};

type Tone = "accent" | "warning" | "success" | "error" | "muted" | "dim" | "thinkingMinimal";

export function renderTakomiHeader(theme: Theme): string[] {
  const accent = (text: string) => theme.fg("accent", text);
  const violet = (text: string) => theme.fg("thinkingMinimal", text);
  const muted = (text: string) => theme.fg("muted", text);
  const dim = (text: string) => theme.fg("dim", text);
  const line = dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return [
    "",
    accent("████████╗ █████╗ ██╗  ██╗ ██████╗ ███╗   ███╗██╗"),
    accent("╚══██╔══╝██╔══██╗██║ ██╔╝██╔═══██╗████╗ ████║██║"),
    violet("   ██║   ███████║█████╔╝ ██║   ██║██╔████╔██║██║"),
    violet("   ██║   ██╔══██║██╔═██╗ ██║   ██║██║╚██╔╝██║██║"),
    accent("   ██║   ██║  ██║██║  ██╗╚██████╔╝██║ ╚═╝ ██║██║"),
    accent("   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝"),
    line,
    `${muted("         Genesis")} ${dim("→")} ${muted("Design")} ${dim("→")} ${muted("Build")}  ${dim("| custom Pi harness runtime")}`,
    "",
  ];
}

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
  const source = state.modeSource ?? "idle";
  if (!state.enabled) return [theme.fg("accent", "Takomi"), theme.fg("dim", "off")].join(" ");
  if (source === "idle") return [theme.fg("accent", "Takomi"), theme.fg("dim", "idle")].join(" ");

  const primary = state.stage ?? state.role;
  const stageBadge = badge(theme, primary, stageTone(state.stage));
  const sourceLabel = source === "manual" ? theme.fg("warning", "manual") : theme.fg("success", source);
  const role = state.stage && state.role !== state.stage ? theme.fg("dim", state.role) : "";
  const plan = state.planMode ? theme.fg("warning", "plan") : theme.fg("dim", "direct");
  const gate = state.launchMode === "manual" ? theme.fg("warning", "review-gate") : "";
  const subagents = state.subagentsEnabled === false ? theme.fg("error", "subagents:off") : "";
  return [theme.fg("accent", "Takomi"), sourceLabel, stageBadge, role, gate || plan, subagents].filter(Boolean).join(" ");
}

export function renderRuntimeWidget(theme: Theme, state: RuntimeHudState): string[] {
  if (!state.enabled || (state.modeSource ?? "idle") === "idle") return [];
  const primary = state.stage ?? state.role;
  const sourceLabel = state.modeSource === "manual" ? theme.fg("warning", "manual") : theme.fg("success", state.modeSource ?? "model");
  const parts = [
    theme.fg("accent", "Takomi"),
    sourceLabel,
    badge(theme, primary, stageTone(state.stage)),
    state.stage && state.role !== state.stage ? theme.fg("dim", `role:${state.role}`) : "",
    state.launchMode === "manual" ? theme.fg("warning", "review-gate") : "",
    state.planMode ? theme.fg("warning", "plan") : theme.fg("dim", "direct"),
    state.subagentsEnabled === false ? theme.fg("error", "subagents:off") : theme.fg("dim", "subagents:on"),
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

  invalidate(): void { }

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
    const left = extensionStatuses.join(this.theme.fg("dim", "  |  "));
    const branch = this.footerData.getGitBranch();
    const rightText = [this.ctx.model?.id || "no-model", branch ? `git:${branch}` : ""].filter(Boolean).join(" | ");
    const right = this.theme.fg("dim", rightText);
    const rightPad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
    const bottomLine = truncateToWidth(`${left}${rightPad}${right}`, width);

    return [topLine, bottomLine];
  }
}

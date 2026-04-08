import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionContext, ReadonlyFooterDataProvider, Theme } from "@mariozechner/pi-coding-agent";
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate(): void;
  dispose?(): void;
}

interface RenderTui {
  requestRender(force?: boolean): void;
}
import {
  stripAnsi,
  visibleWidth,
  truncateToWidth,
  ellipsizeMiddle,
  firstMeaningfulLine,
  sanitizeLogChunk,
  formatDuration,
  formatFooterNumber,
  wrapLabel,
  checklistProgress,
  type ChecklistInput,
} from "./shared";

// ─── View Mode ──────────────────────────────────────────────────────

export type SubagentViewMode = "compact" | "expanded" | "fullscreen";
export type SubagentFocusDirection = "next" | "prev";

let subagentViewMode: SubagentViewMode = "compact";
const subagentUiInstances = new Set<TakomiSubagentUi>();

function refreshSubagentUiInstances(ctx?: ExtensionContext): void {
  for (const instance of subagentUiInstances) {
    if (ctx) instance.refreshWithContext(ctx);
    else instance.refresh();
  }
}

export function getTakomiSubagentViewMode(): SubagentViewMode {
  return subagentViewMode;
}

export function setTakomiSubagentViewMode(mode: SubagentViewMode, ctx?: ExtensionContext): void {
  subagentViewMode = mode;
  refreshSubagentUiInstances(ctx);
}

const VIEW_MODE_CYCLE: SubagentViewMode[] = ["compact", "expanded", "fullscreen"];

export function cycleTakomiSubagentViewMode(ctx?: ExtensionContext): SubagentViewMode {
  const currentIdx = VIEW_MODE_CYCLE.indexOf(subagentViewMode);
  subagentViewMode = VIEW_MODE_CYCLE[(currentIdx + 1) % VIEW_MODE_CYCLE.length];
  refreshSubagentUiInstances(ctx);
  return subagentViewMode;
}

/** Legacy toggle for backward compat — cycles compact ↔ expanded only. */
export function toggleTakomiSubagentViewMode(): SubagentViewMode {
  subagentViewMode = subagentViewMode === "compact" ? "expanded" : "compact";
  refreshSubagentUiInstances();
  return subagentViewMode;
}

export function cycleTakomiSubagentFocus(direction: SubagentFocusDirection, ctx?: ExtensionContext): boolean {
  for (const instance of subagentUiInstances) {
    if (instance.cycleFocus(direction, ctx)) return true;
  }
  return false;
}

// ─── Types ──────────────────────────────────────────────────────────

export type { ChecklistInput };

export type RuntimeHudState = {
  enabled: boolean;
  autoOrch: boolean;
  planMode: boolean;
  role: string;
  stage?: string;
  workflow?: string;
  activeSessionId?: string;
};

export type SubagentPanelState = {
  title?: string;
  status: "running" | "completed" | "blocked";
  agent: string;
  taskLabel: string;
  stage?: string;
  workflow?: string;
  model?: string;
  conversationId?: string;
  checklist?: ChecklistInput;
  summary?: string;
  logs: string[];
  startedAt: number;
  updatedAt: number;
};

type Tone = "accent" | "warning" | "success" | "error" | "muted" | "dim" | "thinkingMinimal";
const SUBAGENT_WIDGET_OPTIONS = { placement: "belowEditor" as const };

// ─── Theme Helpers ──────────────────────────────────────────────────

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
  return theme.fg(tone, `‹${label.toUpperCase()}›`);
}

function statusIcon(status: SubagentPanelState["status"]): string {
  return status === "blocked" ? "✕" : status === "completed" ? "✓" : "◉";
}

function statusTone(status: SubagentPanelState["status"]): Tone {
  return status === "blocked" ? "error" : status === "completed" ? "success" : "warning";
}

function statusText(theme: Theme, status: SubagentPanelState["status"]): string {
  const label = status === "running" ? "RUNNING" : status === "completed" ? "COMPLETED" : "BLOCKED";
  return theme.fg(statusTone(status), `[${label}]`);
}

function taskPrefix(status: SubagentPanelState["status"]): string {
  return status === "blocked" ? "BLOCKED TASK" : status === "completed" ? "COMPLETED TASK" : "ACTIVE TASK";
}

// ─── Progress Bar ───────────────────────────────────────────────────

function miniProgressBar(done: number, total: number, width = 10): string {
  if (total <= 0) return "";
  const filled = Math.round((done / total) * width);
  const empty = width - filled;
  return `${"▓".repeat(filled)}${"░".repeat(empty)} ${done}/${total}`;
}

// ─── Subagent View Hints ────────────────────────────────────────────

function subagentViewHint(theme: Theme): string {
  switch (subagentViewMode) {
    case "compact":
      return theme.fg("dim", "(Alt+T: expand · Alt+Shift+T: fullscreen)");
    case "expanded":
      return theme.fg("dim", "(Alt+T: compact · Alt+Shift+T: fullscreen)");
    case "fullscreen":
      return theme.fg("dim", "(Esc or Alt+T to close)");
  }
}

function currentSubagentViewHint(theme: Theme): string {
  switch (subagentViewMode) {
    case "compact":
      return theme.fg("dim", "(Alt+T: expand | Alt+Shift+T: fullscreen)");
    case "expanded":
      return theme.fg("dim", "(Alt+T: fullscreen | Alt+Shift+T: fullscreen)");
    case "fullscreen":
      return theme.fg("dim", "(Esc or Alt+T to close)");
  }
}

function summarizeStatus(state: SubagentPanelState): string {
  const summary = firstMeaningfulLine(state.summary) ?? firstMeaningfulLine(state.logs.at(-1)) ?? "Waiting for live events…";
  return summary.length > 120 ? `${summary.slice(0, 117)}…` : summary;
}

// ─── Runtime Status / HUD ───────────────────────────────────────────

export function renderRuntimeStatus(theme: Theme, state: RuntimeHudState): string {
  const primary = state.stage ?? state.role;
  const stageBadge = badge(theme, primary, stageTone(state.stage));
  const auto = state.autoOrch ? theme.fg("accent", "auto") : theme.fg("dim", "manual");
  const plan = state.planMode ? theme.fg("warning", "plan") : theme.fg("dim", "direct");
  return [theme.fg("accent", "◎ Takomi"), stageBadge, theme.fg("dim", `role:${state.role}`), auto, plan].join(" ");
}

export function renderRuntimeWidget(theme: Theme, state: RuntimeHudState): string[] {
  if (!state.enabled) return [];
  const parts: string[] = [];

  // Line 1: Main HUD bar
  const primary = state.stage ?? state.role;
  const stageBadge = badge(theme, primary, stageTone(state.stage));
  const auto = state.autoOrch ? theme.fg("accent", "⚡ auto") : theme.fg("dim", "manual");
  const plan = state.planMode ? theme.fg("warning", "📋 plan") : theme.fg("dim", "direct");
  const sessionTag = state.activeSessionId
    ? theme.fg("dim", `session:${ellipsizeMiddle(state.activeSessionId, 12)}`)
    : "";
  const workflowTag = state.workflow
    ? theme.fg("dim", `wf:${state.workflow}`)
    : "";

  parts.push([
    theme.fg("accent", "◎ Takomi"),
    stageBadge,
    theme.fg("dim", `role:${state.role}`),
    auto,
    plan,
    workflowTag,
    sessionTag,
  ].filter(Boolean).join("  "));

  return parts;
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
    const stats = this.theme.fg("dim", `↑${formatFooterNumber(input)} ↓${formatFooterNumber(output)} $${cost.toFixed(3)}`);
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

// ─── Fullscreen Overlay Component ───────────────────────────────────

class FullscreenSubagentComponent implements Component {
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly tui: RenderTui,
    private readonly theme: Theme,
    private readonly getState: () => SubagentPanelState | undefined,
    private readonly done: (result: void) => void,
  ) {
    this.timer = setInterval(() => {
      this.tui.requestRender();
    }, 1000);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  handleInput(data: string): void {
    // Escape or Alt+T closes the overlay
    if (data === "\x1b" || data === "\x1b\x74" || data === "\x1bt") {
      setTakomiSubagentViewMode("compact");
      this.done();
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const state = this.getState();
    const theme = this.theme;
    if (!state) {
      return [
        theme.fg("dim", "─".repeat(width)),
        theme.fg("muted", "  No active subagent."),
        "",
        theme.fg("dim", "  Press Esc to close."),
        theme.fg("dim", "─".repeat(width)),
      ];
    }

    const lines: string[] = [];
    const innerWidth = Math.max(20, width - 4);
    const pad = "  ";
    const tone = statusTone(state.status);
    const border = theme.fg("dim", "─".repeat(width));
    const elapsed = formatDuration(Date.now() - state.startedAt);

    // Top border
    lines.push(border);
    lines.push("");

    // Title bar
    lines.push(`${pad}${theme.fg(tone, `${statusIcon(state.status)} ${taskPrefix(state.status)}`)}  ${statusText(theme, state.status)}  ${theme.fg("dim", `(${elapsed})`)}`);
    lines.push("");

    // Task label (wrapped)
    const taskLines = wrapLabel(state.taskLabel, innerWidth);
    for (const tl of taskLines) {
      lines.push(`${pad}${theme.fg("text" as Tone, tl)}`);
    }
    lines.push("");

    // Metadata grid
    const metaLines: string[] = [];
    metaLines.push(`${pad}${theme.fg("dim", "Agent:")}   ${state.agent}`);
    if (state.model) metaLines.push(`${pad}${theme.fg("dim", "Model:")}   ${state.model}`);
    if (state.workflow) metaLines.push(`${pad}${theme.fg("dim", "Flow:")}    ${state.workflow}`);
    if (state.stage) metaLines.push(`${pad}${theme.fg("dim", "Stage:")}   ${state.stage}`);
    if (state.conversationId) metaLines.push(`${pad}${theme.fg("dim", "Thread:")}  ${ellipsizeMiddle(state.conversationId, 32)}`);
    lines.push(...metaLines);
    lines.push("");

    // Checklist progress
    if (state.checklist?.length) {
      const normalized = state.checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
      const done = normalized.filter((item) => item.done).length;
      lines.push(`${pad}${theme.fg("accent", "Checklist")} ${miniProgressBar(done, normalized.length, 16)}`);
      for (const item of normalized) {
        const icon = item.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
        lines.push(`${pad}  ${icon} ${item.text}`);
      }
      lines.push("");
    }

    // Summary
    if (state.summary) {
      lines.push(`${pad}${theme.fg("accent", "Summary")}`);
      const summaryLines = wrapLabel(state.summary, innerWidth);
      for (const sl of summaryLines) {
        lines.push(`${pad}  ${theme.fg("thinkingMinimal", sl)}`);
      }
      lines.push("");
    }

    // Full log tail
    lines.push(`${pad}${theme.fg("accent", "Output")} ${theme.fg("dim", `(last ${Math.min(state.logs.length, 20)} lines)`)}`);
    const logTail = state.logs.slice(-20);
    if (logTail.length === 0) {
      lines.push(`${pad}  ${theme.fg("dim", "Waiting for first live event...")}`);
    } else {
      for (const logLine of logTail) {
        const cleanLine = truncateToWidth(logLine, innerWidth);
        lines.push(`${pad}  ${theme.fg("dim", cleanLine)}`);
      }
    }
    lines.push("");

    // Bottom hint
    lines.push(`${pad}${currentSubagentViewHint(theme)}`);
    lines.push(border);

    return lines;
  }
}

// ─── Main Subagent UI Class ─────────────────────────────────────────

export class TakomiSubagentUi {
  private readonly runs = new Map<string, SubagentPanelState>();
  private activeRunKey?: string;
  private lastCtx?: ExtensionContext;
  private fullscreenActive = false;
  private fullscreenDismiss?: () => void;
  private fullscreenRequestRender?: () => void;

  constructor(private readonly key: string) {
    subagentUiInstances.add(this);
  }

  private get overlayState(): SubagentPanelState | undefined {
    return this.getActiveState();
  }

  getState(): SubagentPanelState | undefined {
    return this.getActiveState();
  }

  getRunCount(): number {
    return this.runs.size;
  }

  cycleFocus(direction: SubagentFocusDirection, ctx?: ExtensionContext): boolean {
    const runs = this.getOrderedRuns();
    if (runs.length <= 1) return false;
    const currentIndex = Math.max(0, runs.findIndex(({ runKey }) => runKey === this.activeRunKey));
    const delta = direction === "next" ? 1 : -1;
    this.activeRunKey = runs[(currentIndex + delta + runs.length) % runs.length]?.runKey;
    const targetCtx = ctx ?? this.lastCtx;
    if (targetCtx) this.refreshWithContext(targetCtx);
    return true;
  }

  async start(
    ctx: ExtensionContext,
    state: Omit<SubagentPanelState, "logs" | "startedAt" | "updatedAt" | "status"> & { logs?: string[]; status?: SubagentPanelState["status"] },
    runKey?: string,
  ): Promise<void> {
    const now = Date.now();
    const resolvedRunKey = runKey ?? state.conversationId ?? `${state.agent}-${now}`;
    this.runs.set(resolvedRunKey, {
      ...state,
      logs: state.logs ?? [],
      status: state.status ?? "running",
      startedAt: now,
      updatedAt: now,
    });
    this.activeRunKey = resolvedRunKey;
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async update(ctx: ExtensionContext, patch: Partial<SubagentPanelState>, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey, patch);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    this.runs.set(resolvedRunKey, { ...current, ...patch, updatedAt: Date.now() });
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async appendLog(ctx: ExtensionContext, chunk: string, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    const lines = sanitizeLogChunk(chunk);
    if (!lines.length) return;
    const nextLogs = [...current.logs, ...lines].slice(-60);
    this.runs.set(resolvedRunKey, {
      ...current,
      logs: nextLogs,
      updatedAt: Date.now(),
      summary: lines.at(-1) ?? current.summary,
    });
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async complete(ctx: ExtensionContext, patch?: Partial<SubagentPanelState>, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey, patch);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    this.runs.set(resolvedRunKey, { ...current, ...patch, status: "completed", updatedAt: Date.now() });
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async block(ctx: ExtensionContext, patch?: Partial<SubagentPanelState>, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey, patch);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    this.runs.set(resolvedRunKey, { ...current, ...patch, status: "blocked", updatedAt: Date.now() });
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  reset(ctx: ExtensionContext): void {
    this.runs.clear();
    this.activeRunKey = undefined;
    this.lastCtx = ctx;
    this.dismissFullscreen();
    if (ctx.hasUI) {
      ctx.ui.setStatus(this.key, undefined);
      ctx.ui.setWidget(this.key, undefined);
    }
  }

  refresh(): void {
    if (this.lastCtx) this.refreshWithContext(this.lastCtx);
  }

  refreshWithContext(ctx: ExtensionContext): void {
    this.lastCtx = ctx;
    if (!this.getActiveState()) {
      if (ctx.hasUI && subagentViewMode !== "fullscreen") {
        ctx.ui.setStatus(this.key, undefined);
        ctx.ui.setWidget(this.key, undefined);
      }
      return;
    }

    if (subagentViewMode === "fullscreen" && !this.fullscreenActive) {
      this.showFullscreen(ctx);
    } else if (subagentViewMode !== "fullscreen" && this.fullscreenActive) {
      this.dismissFullscreen();
      this.syncChrome(ctx);
    } else {
      this.syncChrome(ctx);
    }
  }

  private dismissFullscreen(): void {
    if (this.fullscreenDismiss) {
      this.fullscreenDismiss();
      this.fullscreenDismiss = undefined;
    }
    this.fullscreenActive = false;
    this.fullscreenRequestRender = undefined;
  }

  private showFullscreen(ctx: ExtensionContext): void {
    if (!ctx.hasUI || this.fullscreenActive) return;
    this.fullscreenActive = true;

    // Fire-and-forget the overlay; it resolves when the user closes it
    void ctx.ui.custom<void>(
      (tui, theme, _keybindings, done) => {
        this.fullscreenDismiss = () => done();
        this.fullscreenRequestRender = () => tui.requestRender();
        return new FullscreenSubagentComponent(tui, theme, () => this.getActiveState(), done);
      },
      {
        overlay: true,
        overlayOptions: {
          width: "92%",
          maxHeight: "80%",
          anchor: "center",
        },
      },
    ).then(() => {
      this.fullscreenActive = false;
      this.fullscreenDismiss = undefined;
      this.fullscreenRequestRender = undefined;
      // After closing overlay, fall back to compact widget
      if (subagentViewMode === "fullscreen") {
        subagentViewMode = "compact";
      }
      if (this.lastCtx && this.getActiveState()) {
        this.syncChrome(this.lastCtx);
      }
    });
  }

  private syncChrome(ctx: ExtensionContext): void {
    if (!ctx.hasUI || !this.getActiveState()) return;

    // If fullscreen mode is requested, launch the overlay
    if (subagentViewMode === "fullscreen" && !this.fullscreenActive) {
      this.showFullscreen(ctx);
      // Still update the status bar even in fullscreen
      this.updateStatusBar(ctx);
      return;
    }

    // If fullscreen is active, just update status bar — the overlay handles rendering
    if (this.fullscreenActive) {
      this.updateStatusBar(ctx);
      this.fullscreenRequestRender?.();
      return;
    }

    // Otherwise render the widget (compact or expanded)
    this.updateStatusBar(ctx);
    this.renderWidget(ctx);
  }

  private updateStatusBar(ctx: ExtensionContext): void {
    const activeState = this.getActiveState();
    if (!activeState) return;
    const theme = ctx.ui.theme;
    const tone = statusTone(activeState.status);
    const label = activeState.status === "blocked" ? "blocked" : activeState.status === "completed" ? "done" : "active";
    const peerSuffix = this.runs.size > 1 ? theme.fg("dim", ` +${this.runs.size - 1} more`) : "";

    ctx.ui.setStatus(this.key, [
      theme.fg(tone, statusIcon(activeState.status)),
      theme.fg("dim", ` ${activeState.agent} · ${label} · ${ellipsizeMiddle(activeState.taskLabel, 36)}`),
      peerSuffix,
    ].join(""));
  }

  private renderWidget(ctx: ExtensionContext): void {
    if (!this.overlayState) return;
    const theme = ctx.ui.theme;
    const lines: string[] = [];
    const runs = this.getOrderedRuns();
    const peerRuns = runs.filter(({ runKey }) => runKey !== this.activeRunKey);
    const activeIndex = Math.max(0, runs.findIndex(({ runKey }) => runKey === this.activeRunKey));
    const runBanner = runs.length > 1
      ? theme.fg("dim", truncateToWidth(
        `Agents ${activeIndex + 1}/${runs.length}  ${runs.slice(0, 4).map(({ runKey, state }) => `${runKey === this.activeRunKey ? "[" : ""}${state.agent}:${state.status}${runKey === this.activeRunKey ? "]" : ""}`).join("  ")}`,
        110,
      ))
      : "";
    const focusHint = runs.length > 1 ? theme.fg("dim", "Alt+N/P: switch agent") : "";
    const treeLine = theme.fg("dim", "│");
    const titleColor: Tone = this.overlayState.status === "blocked" ? "error" : this.overlayState.status === "completed" ? "success" : "accent";
    const elapsed = formatDuration(Date.now() - this.overlayState.startedAt);
    const summary = summarizeStatus(this.overlayState);
    const viewHint = currentSubagentViewHint(theme);

    if (subagentViewMode === "compact" && this.overlayState.status !== "blocked") {
      // ── Compact: 5-6 lines, dense and informative ──
      const compactTitleLines = wrapLabel(this.overlayState.taskLabel, 88).slice(0, 2);
      while (compactTitleLines.length < 2) compactTitleLines.push("");
      const recentLogs = this.overlayState.logs.length > 0 ? this.overlayState.logs.slice(-3) : [summary];

      // Checklist mini-bar
      let checklistBar = "";
      if (this.overlayState.checklist?.length) {
        const normalized = this.overlayState.checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
        const done = normalized.filter((item) => item.done).length;
        checklistBar = ` ${theme.fg("accent", miniProgressBar(done, normalized.length, 8))}`;
      }

      if (runBanner) lines.push(runBanner);

      lines.push(theme.fg(titleColor, `▼ ${taskPrefix(this.overlayState.status)}`));
      lines.push(`${treeLine} ${compactTitleLines[0]}`);
      if (compactTitleLines[1]) lines.push(`${treeLine} ${compactTitleLines[1]}`);
      lines.push(`${treeLine} ${this.overlayState.agent}${this.overlayState.model ? theme.fg("dim", ` (${ellipsizeMiddle(this.overlayState.model, 28)})`) : ""} ${statusText(theme, this.overlayState.status)} ${theme.fg("dim", `(${elapsed})`)}${checklistBar}`);
      for (const logLine of recentLogs) {
        lines.push(`${treeLine} ${theme.fg("dim", "> " + truncateToWidth(logLine || summary, 100))}`);
      }
      if (peerRuns.length > 0) {
        lines.push(`${treeLine} ${theme.fg("dim", `Peers: ${peerRuns.slice(0, 3).map(({ state }) => `${state.agent} ${state.status}`).join("  |  ")}`)}`);
      }
      lines.push(`${theme.fg("dim", `└${"─".repeat(56)}`)} ${viewHint}`);
      ctx.ui.setWidget(this.key, lines, SUBAGENT_WIDGET_OPTIONS);
      return;
    }

    // ── Expanded: 12-15 lines, full detail ──
    lines.push(theme.fg(titleColor, `▼ ${taskPrefix(this.overlayState.status)}`));
    lines.push(`${treeLine}`);

    // Task label
    const taskLines = wrapLabel(this.overlayState.taskLabel, 92).slice(0, 3);
    for (const tl of taskLines) {
      lines.push(`${treeLine}  ${tl}`);
    }
    lines.push(`${treeLine}`);

    // Metadata
    lines.push(`${treeLine} ${theme.fg("dim", "Agent:")}  ${this.overlayState.agent}${this.overlayState.model ? ` (${this.overlayState.model})` : ""}`);
    lines.push(`${treeLine} ${theme.fg("dim", "Status:")} ${statusText(theme, this.overlayState.status)} ${theme.fg("dim", `(${elapsed})`)} ${[viewHint, focusHint].filter(Boolean).join("  ")}`);

    const meta = [];
    if (this.overlayState.workflow) meta.push(`Flow: ${this.overlayState.workflow}`);
    if (this.overlayState.conversationId) meta.push(`Thread: ${ellipsizeMiddle(this.overlayState.conversationId, 20)}`);
    if (meta.length > 0) {
      lines.push(`${treeLine} ${theme.fg("dim", meta.join("  ·  "))}`);
    }
    lines.push(`${treeLine}`);

    // Checklist with progress bar
    if (this.overlayState.checklist?.length) {
      const normalized = this.overlayState.checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
      const done = normalized.filter((item) => item.done).length;
      lines.push(`${treeLine} ${theme.fg("accent", "Progress")} ${miniProgressBar(done, normalized.length, 12)}`);
      for (const item of normalized.slice(0, 6)) {
        const icon = item.done ? theme.fg("success", "✓") : theme.fg("dim", "○");
        lines.push(`${treeLine}   ${icon} ${truncateToWidth(item.text, 80)}`);
      }
      if (normalized.length > 6) {
        lines.push(`${treeLine}   ${theme.fg("dim", `... +${normalized.length - 6} more`)}`);
      }
      lines.push(`${treeLine}`);
    }

    // Summary
    lines.push(`${treeLine} ${theme.fg("thinkingMinimal", ">")} ${summary}`);
    lines.push(`${treeLine}`);

    if (peerRuns.length > 0) {
      lines.push(`${treeLine} ${theme.fg("accent", "Other Agents")}`);
      for (const { state } of peerRuns.slice(0, 4)) {
        lines.push(`${treeLine}   ${theme.fg("dim", `${state.agent} ${state.status} · ${truncateToWidth(summarizeStatus(state), 72)}`)}`);
      }
      lines.push(`${treeLine}`);
    }

    // Recent logs (more lines in expanded)
    const recentLogs = this.overlayState.logs.length > 0
      ? this.overlayState.logs.slice(-10)
      : ["Waiting for first live event..."];
    for (const logLine of recentLogs) {
      lines.push(`${treeLine} ${theme.fg("dim", "> " + truncateToWidth(logLine, 100))}`);
    }

    lines.push(theme.fg("dim", `└${"─".repeat(60)}`));

    ctx.ui.setWidget(this.key, lines, SUBAGENT_WIDGET_OPTIONS);
  }

  private resolveRunKey(runKey?: string, patch?: Partial<SubagentPanelState>): string | undefined {
    const explicit = runKey ?? patch?.conversationId;
    if (explicit && this.runs.has(explicit)) return explicit;
    if (this.activeRunKey && this.runs.has(this.activeRunKey)) return this.activeRunKey;
    return this.getOrderedRuns()[0]?.runKey;
  }

  private getActiveState(): SubagentPanelState | undefined {
    if (this.activeRunKey && this.runs.has(this.activeRunKey)) {
      return this.runs.get(this.activeRunKey);
    }
    const fallback = this.getOrderedRuns()[0];
    if (fallback) {
      this.activeRunKey = fallback.runKey;
      return fallback.state;
    }
    return undefined;
  }

  private getOrderedRuns(): Array<{ runKey: string; state: SubagentPanelState }> {
    return [...this.runs.entries()]
      .map(([runKey, state]) => ({ runKey, state }))
      .sort((a, b) => b.state.updatedAt - a.state.updatedAt);
  }
}

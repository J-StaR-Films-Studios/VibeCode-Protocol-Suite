import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";

let subagentViewMode: "compact" | "expanded" = "compact";
const subagentUiInstances = new Set<TakomiSubagentUi>();

export function getTakomiSubagentViewMode(): "compact" | "expanded" {
  return subagentViewMode;
}

export function setTakomiSubagentViewMode(mode: "compact" | "expanded"): void {
  subagentViewMode = mode;
  for (const instance of subagentUiInstances) instance.refresh();
}

export function toggleTakomiSubagentViewMode(): "compact" | "expanded" {
  subagentViewMode = subagentViewMode === "compact" ? "expanded" : "compact";
  for (const instance of subagentUiInstances) instance.refresh();
  return subagentViewMode;
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

export type ChecklistInput = Array<string | { text: string; done?: boolean }> | undefined;

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

function ellipsizeMiddle(value: string, max = 22): string {
  if (value.length <= max) return value;
  const left = Math.max(6, Math.floor((max - 1) / 2));
  const right = Math.max(6, max - left - 1);
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}

function firstMeaningfulLine(text?: string): string | undefined {
  if (!text) return undefined;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
}

function stripAnsi(value: string): string {
  return value
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ");
}

function sanitizeLogChunk(chunk: string): string[] {
  return stripAnsi(chunk)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(-8);
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
  }
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
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
  return theme.fg(tone, `‹${label.toUpperCase()}›`);
}

function subagentViewHint(theme: Theme): string {
  const action = subagentViewMode === "compact" ? "expand" : "collapse";
  return theme.fg("dim", `(Alt+T or /takomi-subagent-toggle to ${action})`);
}

function visibleWidth(value: string): number {
  return stripAnsi(value).length;
}

function truncateAnsi(value: string, width: number, ellipsis = "..."): string {
  const plain = stripAnsi(value);
  if (plain.length <= width) return plain;
  if (width <= ellipsis.length) return ellipsis.slice(0, width);
  return `${plain.slice(0, width - ellipsis.length)}${ellipsis}`;
}

function padAnsi(value: string, width: number): string {
  const visible = visibleWidth(value);
  return value + " ".repeat(Math.max(0, width - visible));
}

function wrapLabel(value: string, width: number): string[] {
  const plain = stripAnsi(value);
  const target = Math.max(8, width);
  const words = plain.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= target) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= target) {
      current = word;
      continue;
    }
    let remainder = word;
    while (remainder.length > target) {
      lines.push(remainder.slice(0, target));
      remainder = remainder.slice(target);
    }
    current = remainder;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [plain];
}

function checklistProgress(checklist?: ChecklistInput): string | undefined {
  if (!checklist?.length) return undefined;
  const normalized = checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
  const done = normalized.filter((item) => item.done).length;
  return `${done}/${normalized.length} checklist`;
}

function summarizeStatus(state: SubagentPanelState): string {
  const summary = firstMeaningfulLine(state.summary) ?? firstMeaningfulLine(state.logs.at(-1)) ?? "Waiting for live events…";
  return summary.length > 120 ? `${summary.slice(0, 117)}…` : summary;
}

export function renderRuntimeStatus(theme: Theme, state: RuntimeHudState): string {
  const primary = state.stage ?? state.role;
  const stageBadge = badge(theme, primary, stageTone(state.stage));
  const auto = state.autoOrch ? theme.fg("accent", "auto") : theme.fg("dim", "manual");
  const plan = state.planMode ? theme.fg("warning", "plan") : theme.fg("dim", "direct");
  return [theme.fg("accent", "◎ Takomi"), stageBadge, theme.fg("dim", `role:${state.role}`), auto, plan].join(" ");
}

export function renderRuntimeWidget(_theme: Theme, _state: RuntimeHudState): string[] {
  return [];
}



export class TakomiSubagentUi {
  private overlayState?: SubagentPanelState;
  private lastCtx?: ExtensionContext;

  constructor(private readonly key: string) {
    subagentUiInstances.add(this);
  }

  async start(ctx: ExtensionContext, state: Omit<SubagentPanelState, "logs" | "startedAt" | "updatedAt" | "status"> & { logs?: string[]; status?: SubagentPanelState["status"] }): Promise<void> {
    const now = Date.now();
    this.overlayState = {
      ...state,
      logs: state.logs ?? [],
      status: state.status ?? "running",
      startedAt: now,
      updatedAt: now,
    };
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async update(ctx: ExtensionContext, patch: Partial<SubagentPanelState>): Promise<void> {
    if (!this.overlayState) return;
    this.overlayState = { ...this.overlayState, ...patch, updatedAt: Date.now() };
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async appendLog(ctx: ExtensionContext, chunk: string): Promise<void> {
    if (!this.overlayState) return;
    const lines = sanitizeLogChunk(chunk);
    if (!lines.length) return;
    const nextLogs = [...this.overlayState.logs, ...lines].slice(-10);
    this.overlayState = {
      ...this.overlayState,
      logs: nextLogs,
      updatedAt: Date.now(),
      summary: lines.at(-1) ?? this.overlayState.summary,
    };
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async complete(ctx: ExtensionContext, patch?: Partial<SubagentPanelState>): Promise<void> {
    if (!this.overlayState) return;
    this.overlayState = { ...this.overlayState, ...patch, status: "completed", updatedAt: Date.now() };
    this.lastCtx = ctx;
    this.syncChrome(ctx);
    if (ctx.hasUI) {
      setTimeout(() => {
        if (this.overlayState?.status === "completed") {
          ctx.ui.setWidget(this.key, undefined);
          ctx.ui.setStatus(this.key, undefined);
        }
      }, 9000);
    }
  }

  async block(ctx: ExtensionContext, patch?: Partial<SubagentPanelState>): Promise<void> {
    if (!this.overlayState) return;
    this.overlayState = { ...this.overlayState, ...patch, status: "blocked", updatedAt: Date.now() };
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  reset(ctx: ExtensionContext): void {
    this.overlayState = undefined;
    this.lastCtx = ctx;
    if (ctx.hasUI) {
      ctx.ui.setStatus(this.key, undefined);
      ctx.ui.setWidget(this.key, undefined);
    }
  }

  refresh(): void {
    if (this.lastCtx && this.overlayState) this.syncChrome(this.lastCtx);
  }

  private syncChrome(ctx: ExtensionContext): void {
    if (!ctx.hasUI || !this.overlayState) return;
    const theme = ctx.ui.theme;
    const tone: Tone = this.overlayState.status === "blocked" ? "error" : this.overlayState.status === "completed" ? "success" : "warning";
    const statusLabel = this.overlayState.status === "blocked" ? "blocked" : this.overlayState.status === "completed" ? "done" : "active";
    
    // Status Bar
    ctx.ui.setStatus(this.key, [
      theme.fg(tone, this.overlayState.status === "blocked" ? "✕" : this.overlayState.status === "completed" ? "✓" : "◉"),
      theme.fg("dim", ` ${this.overlayState.agent} · ${statusLabel} · ${ellipsizeMiddle(this.overlayState.taskLabel, 36)}`),
    ].join(""));

    const lines: string[] = [];
    const treeLine = theme.fg("dim", "│");
    const titleColor = this.overlayState.status === "blocked" ? "error" : this.overlayState.status === "completed" ? "success" : "toolTitle";
    const taskPrefix = this.overlayState.status === "blocked" ? "BLOCKED TASK" : this.overlayState.status === "completed" ? "COMPLETED TASK" : "ACTIVE TASK";
    const elapsed = formatDuration(Date.now() - this.overlayState.startedAt);
    const statusText = this.overlayState.status === "running"
      ? theme.fg("warning", "[RUNNING]")
      : this.overlayState.status === "completed"
        ? theme.fg("success", "[COMPLETED]")
        : theme.fg("error", "[BLOCKED]");
    const summary = summarizeStatus(this.overlayState);
    const taskLabel = ellipsizeMiddle(this.overlayState.taskLabel, 88);
    const viewHint = subagentViewHint(theme);

    if (subagentViewMode === "compact" && this.overlayState.status !== "blocked") {
      const compactTitleLines = wrapLabel(this.overlayState.taskLabel, 92).slice(0, 2);
      while (compactTitleLines.length < 2) compactTitleLines.push("");
      const latestLog = firstMeaningfulLine(this.overlayState.logs.at(-1));

      lines.push(theme.fg(titleColor, `▼ ${taskPrefix}`));
      lines.push(`${treeLine} ${compactTitleLines[0]}`);
      lines.push(`${treeLine} ${compactTitleLines[1]}`);
      lines.push(`${treeLine} ${this.overlayState.agent}${this.overlayState.model ? theme.fg("dim", ` (${ellipsizeMiddle(this.overlayState.model, 28)})`) : ""} ${statusText} ${theme.fg("dim", `(${elapsed})`)} ${viewHint}`);
      lines.push(`${treeLine} ${theme.fg("thinkingMinimal", ">")} ${summary}`);
      if (latestLog && latestLog !== summary) {
        lines.push(`${treeLine} ${theme.fg("dim", "> " + truncateAnsi(latestLog, 100))}`);
      }
      lines.push(theme.fg("dim", `└${"─".repeat(60)}`));
      ctx.ui.setWidget(this.key, lines, SUBAGENT_WIDGET_OPTIONS);
      return;
    }

    lines.push(theme.fg(titleColor, `▼ ${taskPrefix}: ${this.overlayState.taskLabel}`));
    lines.push(`${treeLine} Agent:  ${this.overlayState.agent}${this.overlayState.model ? ` (${this.overlayState.model})` : ""}`);
    lines.push(`${treeLine} Status: ${statusText} ${theme.fg("dim", `(${elapsed})`)} ${viewHint}`);
    lines.push(treeLine);

    const checklist = checklistProgress(this.overlayState.checklist);
    const meta = [];
    if (this.overlayState.workflow) meta.push(`Workflow: ${this.overlayState.workflow}`);
    if (checklist) meta.push(`Progress: ${checklist}`);
    if (this.overlayState.conversationId) meta.push(`Thread: ${ellipsizeMiddle(this.overlayState.conversationId, 16)}`);
    if (meta.length > 0) {
      lines.push(`${treeLine} ${theme.fg("dim", meta.join(" | "))}`);
      lines.push(treeLine);
    }

    lines.push(`${treeLine} ${theme.fg("thinkingMinimal", ">")} ${summary}`);
    lines.push(treeLine);

    const recentLogs = this.overlayState.logs.length > 0
      ? this.overlayState.logs.slice(-4)
      : ["Waiting for first live event...", "The subagent has been launched and will stream when events arrive."];
    for (const logLine of recentLogs) {
      lines.push(`${treeLine} ${theme.fg("dim", "> " + logLine)}`);
    }

    lines.push(theme.fg("dim", `└${"─".repeat(60)}`));

    ctx.ui.setWidget(this.key, lines, SUBAGENT_WIDGET_OPTIONS);
  }
}

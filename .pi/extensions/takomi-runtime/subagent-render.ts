import type { Theme } from "@mariozechner/pi-coding-agent";
import {
  ellipsizeMiddle,
  firstMeaningfulLine,
  formatDuration,
  truncateToWidth,
  wrapLabel,
} from "./shared";
import type {
  SubagentViewMode,
  TakomiSubagentRenderEntry,
  TakomiSubagentRenderState,
  TakomiSubagentRun,
  TakomiSubagentStatus,
} from "./subagent-types";

interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate(): void;
  dispose?(): void;
}

interface RenderTui {
  requestRender(force?: boolean): void;
}

type Tone = "accent" | "warning" | "success" | "error" | "muted" | "dim" | "thinkingMinimal";

function statusTone(status: TakomiSubagentStatus): Tone {
  return status === "blocked" ? "error" : status === "completed" ? "success" : "warning";
}

function statusLabel(status: TakomiSubagentStatus): string {
  return status === "blocked" ? "BLOCKED" : status === "completed" ? "COMPLETED" : "RUNNING";
}

function statusIcon(status: TakomiSubagentStatus): string {
  return status === "blocked" ? "x" : status === "completed" ? "o" : ">";
}

function summaryText(run: TakomiSubagentRun): string {
  const summary = firstMeaningfulLine(run.summary) ?? firstMeaningfulLine(run.logs.at(-1)) ?? "Waiting for live events.";
  return summary.length > 140 ? `${summary.slice(0, 137)}...` : summary;
}

function checklistText(run: TakomiSubagentRun): string | undefined {
  if (!run.checklist?.length) return undefined;
  const normalized = run.checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
  const done = normalized.filter((item) => item.done).length;
  return `${done}/${normalized.length}`;
}

function metadata(run: TakomiSubagentRun, includeThread: boolean): string[] {
  const lines = [`agent:${run.agent}`];
  if (run.stage) lines.push(`stage:${run.stage}`);
  if (run.workflow) lines.push(`flow:${run.workflow}`);
  if (run.model) lines.push(`model:${ellipsizeMiddle(run.model, 28)}`);
  if (includeThread && run.conversationId) lines.push(`thread:${ellipsizeMiddle(run.conversationId, 20)}`);
  return lines;
}

function viewHint(theme: Theme, mode: SubagentViewMode): string {
  switch (mode) {
    case "compact":
      return theme.fg("dim", "(Alt+T: expanded  Alt+Shift+T: fullscreen  Alt+N/P: focus)");
    case "expanded":
      return theme.fg("dim", "(Alt+T: fullscreen  Alt+Shift+T: fullscreen  Alt+N/P: focus)");
    case "fullscreen":
      return theme.fg("dim", "(Esc: previous view  Alt+T: compact  Alt+N/P: focus)");
  }
}

function relationPrefix(entry: TakomiSubagentRenderEntry): string {
  if (entry.relation === "focused") return ">";
  if (entry.relation === "ancestor") return "|";
  return "-";
}

function renderCompactCard(theme: Theme, entry: TakomiSubagentRenderEntry, width: number): string[] {
  const run = entry.run;
  const tone = entry.relation === "focused" ? statusTone(run.status) : "dim";
  const badge = theme.fg(entry.relation === "focused" ? statusTone(run.status) : "muted", `[${statusLabel(run.status)}]`);
  const line1 = truncateToWidth(
    `${" ".repeat(entry.depth * 2)}${relationPrefix(entry)} ${run.agent} ${badge} ${run.taskLabel}`,
    width,
  );
  const metaParts = [
    ...metadata(run, false),
    checklistText(run) ? `checklist:${checklistText(run)}` : "",
    formatDuration(Date.now() - run.startedAt),
  ].filter(Boolean);
  const line2 = truncateToWidth(`${" ".repeat(entry.depth * 2 + 2)}${metaParts.join("  ")}`, width);
  return [theme.fg(tone, line1), theme.fg("dim", line2)];
}

function renderHeader(theme: Theme, state: TakomiSubagentRenderState, width: number): string {
  const label = [
    theme.fg("accent", "Takomi Stack"),
    theme.fg("dim", `${state.activeCount} tracked`),
    theme.fg("dim", `focus ${state.focusPosition}/${state.activeCount}`),
  ].join("  ");
  return truncateToWidth(label, width);
}

function renderExpandedPath(theme: Theme, state: TakomiSubagentRenderState, width: number, fullscreen: boolean): string[] {
  const lines: string[] = [];
  const detailWidth = Math.max(32, width - 4);
  for (const entry of state.activePath) {
    const run = entry.run;
    const isFocused = entry.relation === "focused";
    const tone = isFocused ? statusTone(run.status) : "dim";
    const label = truncateToWidth(
      `${" ".repeat(entry.depth * 2)}${relationPrefix(entry)} ${run.agent} [${statusLabel(run.status)}] ${run.taskLabel}`,
      width,
    );
    lines.push(theme.fg(tone, label));

    const metaLine = metadata(run, true).join("  ");
    lines.push(theme.fg("dim", truncateToWidth(`${" ".repeat(entry.depth * 2 + 2)}${metaLine}`, width)));

    if (!isFocused) continue;

    if (run.checklist?.length) {
      const normalized = run.checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
      lines.push(theme.fg("accent", `${" ".repeat(entry.depth * 2 + 2)}Checklist ${checklistText(run)}`));
      for (const item of normalized.slice(0, fullscreen ? 10 : 5)) {
        const icon = item.done ? theme.fg("success", "x") : theme.fg("dim", "o");
        lines.push(truncateToWidth(`${" ".repeat(entry.depth * 2 + 4)}${icon} ${item.text}`, width));
      }
    }

    lines.push(theme.fg("thinkingMinimal", truncateToWidth(`${" ".repeat(entry.depth * 2 + 2)}Summary: ${summaryText(run)}`, width)));

    const logTail = run.logs.length > 0
      ? run.logs.slice(-(fullscreen ? 12 : 5))
      : ["Waiting for first live event."];
    lines.push(theme.fg("accent", `${" ".repeat(entry.depth * 2 + 2)}Recent output`));
    for (const logLine of logTail) {
      for (const wrapped of wrapLabel(logLine, detailWidth - entry.depth * 2 - 4).slice(0, 2)) {
        lines.push(theme.fg("dim", truncateToWidth(`${" ".repeat(entry.depth * 2 + 4)}${wrapped}`, width)));
      }
    }
  }
  return lines;
}

function renderPeerSection(theme: Theme, state: TakomiSubagentRenderState, width: number): string[] {
  if (state.peerRuns.length === 0) return [];
  const lines = [theme.fg("accent", "Other Active")];
  for (const entry of state.peerRuns.slice(0, 6)) {
    const run = entry.run;
    const line = truncateToWidth(`- ${run.agent} [${statusLabel(run.status)}] ${summaryText(run)}`, width);
    lines.push(theme.fg("dim", line));
  }
  return lines;
}

export function renderSubagentWidget(theme: Theme, state: TakomiSubagentRenderState, width = 110): string[] {
  if (!state.focusedRun) return [theme.fg("muted", "No active Takomi subagent.")];

  if (state.mode === "compact") {
    const lines = [renderHeader(theme, state, width)];
    for (const entry of state.compactRuns) {
      lines.push(...renderCompactCard(theme, entry, width));
    }
    lines.push(theme.fg("thinkingMinimal", truncateToWidth(`Summary: ${summaryText(state.focusedRun)}`, width)));
    lines.push(viewHint(theme, state.mode));
    return lines;
  }

  const lines = [
    renderHeader(theme, state, width),
    ...renderExpandedPath(theme, state, width, false),
    ...renderPeerSection(theme, state, width),
    viewHint(theme, state.mode),
  ];
  return lines;
}

export function renderSubagentStatus(theme: Theme, state: TakomiSubagentRenderState): string | undefined {
  const run = state.focusedRun;
  if (!run) return undefined;
  const tone = statusTone(run.status);
  const parts = [
    theme.fg(tone, statusIcon(run.status)),
    theme.fg("dim", `${run.agent} ${statusLabel(run.status).toLowerCase()} ${ellipsizeMiddle(run.taskLabel, 36)}`),
    state.activeCount > 1 ? theme.fg("dim", `+${state.activeCount - 1} more`) : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export class FullscreenSubagentComponent implements Component {
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(
    private readonly tui: RenderTui,
    private readonly theme: Theme,
    private readonly getState: () => TakomiSubagentRenderState,
    private readonly onEscape: () => void,
    private readonly onToggle: () => void,
    private readonly onNextFocus: () => void,
    private readonly onPrevFocus: () => void,
  ) {
    this.timer = setInterval(() => {
      this.tui.requestRender();
    }, 1000);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  invalidate(): void {}

  handleInput(data: string): void {
    if (data === "\x1b") {
      this.onEscape();
      return;
    }
    if (data === "\x1bt" || data === "\x1b\x74") {
      this.onToggle();
      return;
    }
    if (data === "\x1bn" || data === "\x1b\x6e") {
      this.onNextFocus();
      return;
    }
    if (data === "\x1bp" || data === "\x1b\x70") {
      this.onPrevFocus();
    }
  }

  render(width: number): string[] {
    const state = this.getState();
    if (!state.focusedRun) {
      return [
        this.theme.fg("muted", "No active Takomi subagent."),
        "",
        viewHint(this.theme, "fullscreen"),
      ];
    }

    const border = this.theme.fg("dim", "-".repeat(Math.max(20, width)));
    const lines = [
      border,
      renderHeader(this.theme, state, width),
      ...renderExpandedPath(this.theme, state, width, true),
      ...renderPeerSection(this.theme, state, width),
      viewHint(this.theme, "fullscreen"),
      border,
    ];
    return lines;
  }
}

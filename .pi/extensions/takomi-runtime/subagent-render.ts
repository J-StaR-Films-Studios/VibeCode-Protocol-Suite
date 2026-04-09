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
  return status === "blocked" ? "✖" : status === "completed" ? "✔" : "⠧";
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
  const hints = {
    compact: "Alt+T: expand | Alt+Shift+T: full | Alt+N/P: focus",
    expanded: "Alt+T: full | Alt+Shift+T: full | Alt+N/P: focus",
    fullscreen: "Esc: back | Alt+T: compact | Alt+N/P: focus",
  };
  return theme.fg("muted", hints[mode]);
}

function relationPrefix(entry: TakomiSubagentRenderEntry): string {
  if (entry.relation === "focused") return "▼";
  if (entry.relation === "ancestor") return "├─";
  return "│ ";
}

function renderCompactCard(theme: Theme, entry: TakomiSubagentRenderEntry, width: number): string[] {
  const run = entry.run;
  const isFocused = entry.relation === "focused";
  const tone = isFocused ? statusTone(run.status) : "muted";
  const badge = theme.fg(tone, `[${statusLabel(run.status)}]`);
  
  const indent = " ".repeat(entry.depth * 2);
  const prefix = relationPrefix(entry);
  
  const line1 = truncateToWidth(
    `${indent}${theme.fg(tone, prefix)} ${theme.fg(isFocused ? "accent" : tone, run.agent)} ${badge} ${theme.fg("dim", run.taskLabel)}`,
    width,
  );
  
  const metaParts = [
    ...metadata(run, false),
    checklistText(run) ? `tasks:${checklistText(run)}` : "",
    formatDuration(Date.now() - run.startedAt),
  ].filter(Boolean);
  
  const branch = isFocused ? "└─" : "│ ";
  const line2 = truncateToWidth(`${indent}${theme.fg(tone, branch)} ${theme.fg("dim", metaParts.join(" | "))}`, width);
  
  return [line1, line2];
}

function renderHeader(theme: Theme, state: TakomiSubagentRenderState, width: number): string {
  const label = [
    theme.fg("dim", "[ takomi ]"),
    theme.fg("accent", "ACTIVE RUNTIME"),
    theme.fg("dim", `${state.focusPosition}/${state.activeCount}`),
  ].join(" - ");
  return truncateToWidth(label, width);
}

function renderExpandedPath(theme: Theme, state: TakomiSubagentRenderState, width: number, fullscreen: boolean): string[] {
  const lines: string[] = [];
  const detailWidth = Math.max(32, width - 4);
  
  for (let i = 0; i < state.activePath.length; i++) {
    const entry = state.activePath[i];
    const run = entry.run;
    const isFocused = entry.relation === "focused";
    const tone = isFocused ? statusTone(run.status) : "muted";
    
    const prefix = relationPrefix(entry);
    const indentStr = " ".repeat(entry.depth * 2);
    const innerIndent = indentStr + (isFocused ? "│ " : "│ "); 
    
    const agentHeader = theme.fg(tone, `${indentStr}${prefix} ${run.agent}`);
    const taskHeader = theme.fg("dim", run.taskLabel);
    const badge = theme.fg(tone, `[${statusLabel(run.status)}]`);
    
    lines.push(truncateToWidth(`${agentHeader} ${badge} ${taskHeader}`, width));

    const metaParts = metadata(run, true);
    if (metaParts.length > 0) {
      lines.push(theme.fg("muted", truncateToWidth(`${innerIndent}${metaParts.join(" | ")}`, width)));
    }

    if (!isFocused) continue;

    lines.push(theme.fg(tone, innerIndent));

    if (run.checklist?.length) {
      const normalized = run.checklist.map((item) => (typeof item === "string" ? { text: item, done: false } : item));
      lines.push(theme.fg(tone, `${innerIndent}Checklist ${checklistText(run)}`));
      for (const item of normalized.slice(0, fullscreen ? 10 : 5)) {
        const icon = item.done ? theme.fg("success", "[✓]") : theme.fg("dim", "[ ]");
        lines.push(truncateToWidth(`${innerIndent}  ${icon} ${item.text}`, width));
      }
      lines.push(theme.fg(tone, innerIndent));
    }

    lines.push(theme.fg("thinkingMinimal", truncateToWidth(`${innerIndent}Summary: ${summaryText(run)}`, width)));

    const logTail = run.logs.length > 0
      ? run.logs.slice(-(fullscreen ? 8 : 4))
      : ["Waiting for first live event..."];
      
    lines.push(theme.fg("dim", `${innerIndent}Output:`));
    for (const logLine of logTail) {
      for (const wrapped of wrapLabel(logLine, detailWidth - entry.depth * 2 - 4).slice(0, 2)) {
        lines.push(theme.fg("dim", truncateToWidth(`${innerIndent}  > ${wrapped}`, width)));
      }
    }
    
    if (i === state.activePath.length - 1) {
       lines.push(theme.fg(tone, `${indentStr}└${"─".repeat(Math.max(10, width - indentStr.length - 1))}`));
    }
  }
  return lines;
}

function renderPeerSection(theme: Theme, state: TakomiSubagentRenderState, width: number): string[] {
  if (state.peerRuns.length === 0) return [];
  const lines = ["", theme.fg("muted", "--- Background / Queued ---")];
  for (const entry of state.peerRuns.slice(0, 6)) {
    const run = entry.run;
    const tone = statusTone(run.status);
    const badge = theme.fg(tone, `[${statusLabel(run.status)}]`);
    const line = truncateToWidth(`  ${badge} ${run.agent} ${summaryText(run)}`, width);
    lines.push(theme.fg("dim", line));
  }
  return lines;
}

export function renderSubagentWidget(theme: Theme, state: TakomiSubagentRenderState, width = 110): string[] {
  if (!state.focusedRun) return [theme.fg("dim", "No active Takomi subagent.")];

  if (state.mode === "compact") {
    const lines = [renderHeader(theme, state, width), ""];
    for (const entry of state.compactRuns) {
      lines.push(...renderCompactCard(theme, entry, width));
    }
    const indent = " ".repeat(Math.max(0, (state.compactRuns.length - 1) * 2));
    lines.push(theme.fg("thinkingMinimal", truncateToWidth(`${indent}  Summary: ${summaryText(state.focusedRun)}`, width)));
    lines.push("");
    lines.push(viewHint(theme, state.mode));
    return lines;
  }

  const lines = [
    renderHeader(theme, state, width),
    "",
    ...renderExpandedPath(theme, state, width, false),
    ...renderPeerSection(theme, state, width),
    "",
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
        this.theme.fg("dim", "No active Takomi subagent."),
        "",
        viewHint(this.theme, "fullscreen"),
      ];
    }

    const borderTop = this.theme.fg("dim", "=".repeat(Math.max(20, width)));
    const borderBottom = this.theme.fg("dim", "=".repeat(Math.max(20, width)));
    const lines = [
      borderTop,
      renderHeader(this.theme, state, width),
      "",
      ...renderExpandedPath(this.theme, state, width, true),
      ...renderPeerSection(this.theme, state, width),
      "",
      viewHint(this.theme, "fullscreen"),
      borderBottom,
    ];
    return lines;
  }
}

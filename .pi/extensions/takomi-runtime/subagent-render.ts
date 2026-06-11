import type { Theme } from "@earendil-works/pi-coding-agent";
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
  TakomiBoardTaskStatus,
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

const EXPANDED_WIDGET_OUTPUT_LINES = 2;
const EXPANDED_WIDGET_ACTIVITY_LINES = 1;
const FULLSCREEN_MAX_VISIBLE_LINES = 15;
const FULLSCREEN_PAGE_STEP = 5;

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
  const fallback = isBoardBackedRun(run) && run.status === "completed" && run.boardTaskStatus !== "completed"
    ? "Subagent run finished. Board task is still awaiting checklist/status completion."
    : "Waiting for live events.";
  const summary = firstMeaningfulLine(run.outputText) ?? firstMeaningfulLine(run.summary) ?? firstMeaningfulLine(run.logs.at(-1)) ?? fallback;
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
  if (run.thinking) lines.push(`think:${run.thinking}`);
  if (run.fallbackModels?.length) lines.push(`fallbacks:${run.fallbackModels.length}`);
  if (includeThread && run.conversationId) lines.push(`thread:${ellipsizeMiddle(run.conversationId, 20)}`);
  if (isBoardBackedRun(run)) {
    const taskState = boardStatusLabel(run.boardTaskStatus);
    if (taskState) lines.push(`task:${taskState}`);
    lines.push(`run:${runLifecycleLabel(run)}`);
  }
  return lines;
}

function isBoardBackedRun(run: TakomiSubagentRun): boolean {
  return run.source === "runtime-board" || Boolean(run.boardTaskStatus);
}

function boardStatusLabel(status?: TakomiBoardTaskStatus): string | undefined {
  return status;
}

function runLifecycleLabel(run: TakomiSubagentRun): string {
  return run.status === "blocked" ? "blocked" : run.status === "completed" ? "finished" : "running";
}

function displayTone(run: TakomiSubagentRun): Tone {
  if (run.boardTaskStatus === "blocked" || run.status === "blocked") return "error";
  if (run.boardTaskStatus === "completed") return "success";
  if (isBoardBackedRun(run) && run.status === "completed") return "accent";
  return "warning";
}

function displayLabel(run: TakomiSubagentRun): string {
  if (run.boardTaskStatus === "blocked" || run.status === "blocked") return "BLOCKED";
  if (run.boardTaskStatus === "completed") return "COMPLETED";
  if (isBoardBackedRun(run) && run.status === "completed") return "FINISHED";
  if (run.boardTaskStatus === "pending") return "PENDING";
  return "RUNNING";
}

function displayIcon(run: TakomiSubagentRun): string {
  if (run.boardTaskStatus === "blocked" || run.status === "blocked") return "x";
  if (run.boardTaskStatus === "completed") return "+";
  if (isBoardBackedRun(run) && run.status === "completed") return ">";
  return "~";
}

function outputParagraphs(run: TakomiSubagentRun): string[] {
  if (!run.outputText?.trim()) return [];
  return run.outputText
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function renderWrappedBlock(
  theme: Theme,
  tone: Tone,
  prefix: string,
  text: string,
  wrapWidth: number,
  width: number,
): string[] {
  return wrapLabel(text, wrapWidth)
    .map((line) => theme.fg(tone, truncateToWidth(`${prefix}${line}`, width)));
}

function renderWrappedTail(
  theme: Theme,
  tone: Tone,
  prefix: string,
  lines: string[],
  wrapWidth: number,
  width: number,
  limit: number,
): string[] {
  if (limit <= 0) return [];
  const rendered = lines.flatMap((line) => renderWrappedBlock(theme, tone, prefix, line, wrapWidth, width));
  return rendered.slice(-limit);
}

function viewHint(theme: Theme, mode: SubagentViewMode): string {
  const hints = {
    compact: "Alt+T: expand | Alt+Shift+T: fullscreen | Alt+N/P: focus",
    expanded: "Alt+T: fullscreen | Alt+Shift+T: fullscreen | Alt+N/P: focus",
    fullscreen: "Esc: back | Up/Down/PgUp/PgDn: scroll | End: live",
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
  const tone = isFocused ? displayTone(run) : "muted";
  const badge = theme.fg(tone, `[${displayLabel(run)}]`);
  
  const indent = " ".repeat(entry.depth * 2);
  const prefix = relationPrefix(entry);
  
  const line1 = truncateToWidth(
    `${indent}${theme.fg(tone, prefix)} ${theme.fg(isFocused ? "accent" : tone, run.agent)} ${badge} ${theme.fg("dim", run.taskLabel)}`,
    width,
  );
  
  const metaParts = [
    ...metadata(run, false),
    checklistText(run) ? `tasks:${checklistText(run)}` : "",
    run.logs.length ? `activity:${run.logs.length}` : "",
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

function widgetStackEntries(state: TakomiSubagentRenderState): TakomiSubagentRenderEntry[] {
  const focused = state.activePath.at(-1);
  const parent = state.activePath.at(-2);
  if (!focused) return [];
  if (parent) return [parent, focused];
  const firstPeer = state.peerRuns[0];
  return firstPeer ? [focused, firstPeer] : [focused];
}

function renderExpandedWidget(theme: Theme, state: TakomiSubagentRenderState, width: number): string[] {
  const focusedRun = state.focusedRun;
  if (!focusedRun) return [theme.fg("dim", "No active Takomi subagent.")];

  const lines = [renderHeader(theme, state, width), ""];
  for (const entry of widgetStackEntries(state)) {
    lines.push(...renderCompactCard(theme, entry, width));
  }

  lines.push("");

  const checklist = checklistText(focusedRun);
  if (checklist) {
    lines.push(theme.fg("warning", truncateToWidth(`Checklist ${checklist}`, width)));
  }

  lines.push(theme.fg("thinkingMinimal", truncateToWidth(`Summary: ${summaryText(focusedRun)}`, width)));
  lines.push(theme.fg("dim", "Live output:"));

  const outputTail = renderWrappedTail(
    theme,
    "dim",
    "  ",
    outputParagraphs(focusedRun).slice(-1),
    Math.max(24, width - 4),
    width,
    EXPANDED_WIDGET_OUTPUT_LINES,
  );
  if (outputTail.length > 0) {
    lines.push(...outputTail);
  } else {
    lines.push(theme.fg("dim", truncateToWidth("  Waiting for first live output...", width)));
  }

  if (focusedRun.logs.length > 0) {
    lines.push(theme.fg("muted", "Recent activity:"));
    lines.push(
      ...renderWrappedTail(
        theme,
        "muted",
        "  - ",
        focusedRun.logs.slice(-1),
        Math.max(24, width - 6),
        width,
        EXPANDED_WIDGET_ACTIVITY_LINES,
      ),
    );
  }

  if (state.activeCount > 1) {
    const extra = state.activeCount - 1;
    lines.push(theme.fg("muted", truncateToWidth(`Also active: ${extra} other run${extra === 1 ? "" : "s"}`, width)));
  }

  lines.push("");
  lines.push(viewHint(theme, state.mode));
  return lines;
}

function renderExpandedPath(theme: Theme, state: TakomiSubagentRenderState, width: number, fullscreen: boolean): string[] {
  const lines: string[] = [];
  const detailWidth = Math.max(32, width - 4);
  
  for (let i = 0; i < state.activePath.length; i++) {
    const entry = state.activePath[i];
    const run = entry.run;
    const isFocused = entry.relation === "focused";
    const tone = isFocused ? displayTone(run) : "muted";
    
    const prefix = relationPrefix(entry);
    const indentStr = " ".repeat(entry.depth * 2);
    const innerIndent = indentStr + (isFocused ? "│ " : "│ "); 
    
    const agentHeader = theme.fg(tone, `${indentStr}${prefix} ${run.agent}`);
    const taskHeader = theme.fg("dim", run.taskLabel);
    const badge = theme.fg(tone, `[${displayLabel(run)}]`);
    
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

    lines.push(theme.fg("dim", `${innerIndent}Output:`));
    const paragraphs = outputParagraphs(run);
    if (paragraphs.length === 0) {
      lines.push(theme.fg("dim", truncateToWidth(`${innerIndent}  Waiting for first live output...`, width)));
    } else {
      const outputWrapWidth = detailWidth - entry.depth * 2 - 2;
      paragraphs.slice(0, fullscreen ? 4 : 2).forEach((paragraph, paragraphIndex) => {
        lines.push(...renderWrappedBlock(theme, "dim", `${innerIndent}  `, paragraph, outputWrapWidth, width));
        if (paragraphIndex < Math.min(paragraphs.length, fullscreen ? 4 : 2) - 1) {
          lines.push(theme.fg("dim", innerIndent));
        }
      });
    }

    if (run.logs.length > 0) {
      const logTail = run.logs.slice(-(fullscreen ? 6 : 3));
      lines.push(theme.fg("muted", `${innerIndent}Activity:`));
      for (const logLine of logTail) {
        lines.push(...renderWrappedBlock(theme, "muted", `${innerIndent}  - `, logLine, detailWidth - entry.depth * 2 - 4, width).slice(0, 2));
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
    const tone = displayTone(run);
    const badge = theme.fg(tone, `[${displayLabel(run)}]`);
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

  return renderExpandedWidget(theme, state, width);
}

export function renderSubagentStatus(theme: Theme, state: TakomiSubagentRenderState): string | undefined {
  const run = state.focusedRun;
  if (!run) return undefined;
  const tone = displayTone(run);
  const parts = [
    theme.fg(tone, displayIcon(run)),
    theme.fg("dim", `${run.agent} ${displayLabel(run).toLowerCase()} ${ellipsizeMiddle(run.taskLabel, 36)}`),
    run.model ? theme.fg("dim", ellipsizeMiddle(run.model, 24)) : "",
    run.thinking ? theme.fg("dim", `think:${run.thinking}`) : "",
    state.activeCount > 1 ? theme.fg("dim", `+${state.activeCount - 1} more`) : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export class FullscreenSubagentComponent implements Component {
  private readonly timer: ReturnType<typeof setInterval>;
  private scrollOffset = 0;
  private autoFollow = true;
  private lastFocusedRunKey?: string;

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
    if (data === "\x1b[A" || data === "k") {
      this.scrollBy(-1);
      return;
    }
    if (data === "\x1b[B" || data === "j") {
      this.scrollBy(1);
      return;
    }
    if (data === "\x1b[5~") {
      this.scrollBy(-FULLSCREEN_PAGE_STEP);
      return;
    }
    if (data === "\x1b[6~" || data === " ") {
      this.scrollBy(FULLSCREEN_PAGE_STEP);
      return;
    }
    if (data === "\x1b[F" || data === "\x1bOF" || data === "G") {
      this.autoFollow = true;
      this.tui.requestRender();
      return;
    }
    if (data === "\x1b[H" || data === "\x1bOH" || data === "g") {
      this.autoFollow = false;
      this.scrollOffset = 0;
      this.tui.requestRender();
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

  private scrollBy(delta: number): void {
    this.autoFollow = false;
    this.scrollOffset = Math.max(0, this.scrollOffset + delta);
    this.tui.requestRender();
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

    const contentLines = [
      ...renderExpandedPath(this.theme, state, width, true),
      ...renderPeerSection(this.theme, state, width),
    ];
    const focusedRunKey = state.focusedRun.runKey;
    if (focusedRunKey !== this.lastFocusedRunKey) {
      this.lastFocusedRunKey = focusedRunKey;
      this.autoFollow = true;
    }

    const maxOffset = Math.max(0, contentLines.length - FULLSCREEN_MAX_VISIBLE_LINES);
    if (this.autoFollow || this.scrollOffset > maxOffset) {
      this.scrollOffset = maxOffset;
    }
    this.scrollOffset = Math.max(0, Math.min(maxOffset, this.scrollOffset));

    const visibleLines = contentLines.slice(this.scrollOffset, this.scrollOffset + FULLSCREEN_MAX_VISIBLE_LINES);
    while (visibleLines.length < FULLSCREEN_MAX_VISIBLE_LINES) visibleLines.push("");

    const remainingBelow = Math.max(0, maxOffset - this.scrollOffset);
    const scrollLabel = this.autoFollow && remainingBelow === 0
      ? "Scroll: live"
      : `Scroll: up:${this.scrollOffset} down:${remainingBelow}`;

    return [
      this.theme.fg("dim", "=".repeat(Math.max(20, width))),
      renderHeader(this.theme, state, width),
      this.theme.fg("muted", truncateToWidth(scrollLabel, width)),
      ...visibleLines,
      viewHint(this.theme, "fullscreen"),
      this.theme.fg("dim", "=".repeat(Math.max(20, width))),
    ];
  }
}

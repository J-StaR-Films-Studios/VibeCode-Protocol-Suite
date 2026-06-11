/**
 * Takomi Context Panel - right-side overlay showing session context.
 *
 * Tracks changed files, tool usage, and active Takomi work.
 * Toggled with Alt+C or /takomi-context.
 */

import { accessSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { ellipsizeMiddle, formatDuration, truncateToWidth, visibleWidth } from "./shared";

interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate(): void;
}

interface OverlayHandle {
  hide(): void;
  setHidden(hidden: boolean): void;
  isHidden(): boolean;
}

export type FileChange = {
  path: string;
  action: "M" | "+";
  timestamp: number;
  added?: number;
  removed?: number;
};

export type ToolUseCount = {
  [tool: string]: number;
};

export type ContextRuntimeState = {
  role?: string;
  stage?: string;
  workflow?: string;
  activeSessionId?: string;
  autoOrch?: boolean;
  launchMode?: string;
  planMode?: boolean;
  activeSubagent?: string;
  activeSubagentAgent?: string;
  activeSubagentTask?: string;
  activeSubagentStatus?: "running" | "completed" | "blocked" | string;
};

export type ContextPanelState = {
  fileChanges: FileChange[];
  toolUses: ToolUseCount;
  sessionStart: number;
  activeMs: number;
  lastActivityAt: number;
  lastToolAt: number;
  runtime: ContextRuntimeState;
  scrollOffset: number;
};

type ToolCallInput = Record<string, unknown>;

const ACTIVE_GAP_THRESHOLD_MS = 15 * 60 * 1000;

type BoardCounts = {
  completed: number;
  pending: number;
  inProgress: number;
  blocked: number;
};

type BoardCountsCacheEntry = {
  checkedAt: number;
  mtimeMs: number;
  counts?: BoardCounts;
};

const BOARD_COUNTS_CACHE_MS = 1_000;
const boardCountsCache = new Map<string, BoardCountsCacheEntry>();

function createEmptyState(sessionStart = Date.now(), runtime: ContextRuntimeState = {}): ContextPanelState {
  return {
    fileChanges: [],
    toolUses: {},
    sessionStart,
    activeMs: 0,
    lastActivityAt: sessionStart,
    lastToolAt: 0,
    runtime,
    scrollOffset: 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function normalizeToolPath(input: ToolCallInput): string | undefined {
  const value = firstString(input.path, input.file_path, input.filePath);
  return value?.replace(/^@/, "");
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function lineDeltaForEdit(input: ToolCallInput): { added?: number; removed?: number } {
  const edits = Array.isArray(input.edits)
    ? input.edits.map(asRecord)
    : typeof input.oldText === "string" || typeof input.newText === "string"
      ? [input]
      : [];

  let added = 0;
  let removed = 0;
  for (const edit of edits) {
    const oldText = typeof edit.oldText === "string" ? edit.oldText : "";
    const newText = typeof edit.newText === "string" ? edit.newText : "";
    const oldLines = countLines(oldText);
    const newLines = countLines(newText);
    if (newLines > oldLines) added += newLines - oldLines;
    if (oldLines > newLines) removed += oldLines - newLines;
  }

  return {
    ...(added > 0 ? { added } : {}),
    ...(removed > 0 ? { removed } : {}),
  };
}

function lineDeltaForWrite(input: ToolCallInput): { added?: number; removed?: number } {
  const content = typeof input.content === "string" ? input.content : undefined;
  if (content === undefined) return {};
  const added = countLines(content);
  return added > 0 ? { added } : {};
}

function changeFromTool(toolName: string, input: ToolCallInput, actionOverride?: "M" | "+"): FileChange | undefined {
  if (toolName !== "edit" && toolName !== "write") return undefined;
  const filePath = normalizeToolPath(input);
  if (!filePath) return undefined;
  const delta = toolName === "write" ? lineDeltaForWrite(input) : lineDeltaForEdit(input);
  return {
    path: filePath,
    action: actionOverride ?? (toolName === "write" ? "+" : "M"),
    timestamp: Date.now(),
    ...delta,
  };
}

function formatDiff(change: FileChange, theme: Theme): string {
  const parts = [];
  if (change.added && change.added > 0) parts.push(theme.fg("success", `+${change.added}`));
  if (change.removed && change.removed > 0) parts.push(theme.fg("error", `-${change.removed}`));
  return parts.join(" ");
}

function toTimestampMs(entry: { timestamp?: unknown; message?: { timestamp?: unknown } }): number | undefined {
  if (typeof entry.message?.timestamp === "number") return entry.message.timestamp;
  if (typeof entry.timestamp === "string") {
    const parsed = Date.parse(entry.timestamp);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function calculateActiveMs(timestamps: number[]): number {
  const sorted = [...new Set(timestamps.filter((value) => Number.isFinite(value)))].sort((a, b) => a - b);
  let activeMs = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const delta = sorted[i] - sorted[i - 1];
    if (delta > 0 && delta <= ACTIVE_GAP_THRESHOLD_MS) activeMs += delta;
  }
  return activeMs;
}

function formatDisplayPath(filePath: string, cwd?: string): string {
  const normalized = filePath.replace(/^@/, "");
  const absolute = path.isAbsolute(normalized) ? normalized : undefined;
  if (absolute && cwd) {
    const rel = path.relative(cwd, absolute);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.replace(/\\/g, "/");
  }
  return normalized.replace(/\\/g, "/");
}

function loadBoardCounts(cwd: string, sessionId?: string): BoardCounts | undefined {
  if (!sessionId) return undefined;
  const stateFile = path.join(cwd, ".pi", "takomi", "orchestrator", `${sessionId}.json`);
  const cached = boardCountsCache.get(stateFile);
  const checkedAt = Date.now();

  if (cached && checkedAt - cached.checkedAt < BOARD_COUNTS_CACHE_MS) return cached.counts;

  try {
    const mtimeMs = statSync(stateFile).mtimeMs;
    if (cached && cached.mtimeMs === mtimeMs) {
      boardCountsCache.set(stateFile, { ...cached, checkedAt });
      return cached.counts;
    }

    const parsed = JSON.parse(readFileSync(stateFile, "utf8")) as { tasks?: Array<{ status?: string }> };
    const counts: BoardCounts = { completed: 0, pending: 0, inProgress: 0, blocked: 0 };
    for (const task of parsed.tasks ?? []) {
      if (task.status === "completed") counts.completed += 1;
      else if (task.status === "in-progress") counts.inProgress += 1;
      else if (task.status === "blocked") counts.blocked += 1;
      else counts.pending += 1;
    }
    boardCountsCache.set(stateFile, { checkedAt, mtimeMs, counts });
    return counts;
  } catch {
    boardCountsCache.set(stateFile, { checkedAt, mtimeMs: 0, counts: undefined });
    return undefined;
  }
}

function formatBoardCounts(counts: BoardCounts): string {
  const parts = [
    counts.completed ? `${counts.completed} done` : "",
    counts.inProgress ? `${counts.inProgress} active` : "",
    counts.pending ? `${counts.pending} pending` : "",
    counts.blocked ? `${counts.blocked} blocked` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "0 tasks";
}

class ContextPanelComponent implements Component {
  constructor(
    private readonly theme: Theme,
    private readonly getState: () => ContextPanelState,
    private readonly getCtx: () => ExtensionContext | undefined,
  ) { }

  invalidate(): void { }

  private maxRenderLines(): number {
    const rows = typeof process.stdout.rows === "number" && process.stdout.rows > 0 ? process.stdout.rows : 30;
    return Math.max(10, Math.floor(rows * 0.8));
  }

  private applyViewport(lines: string[], panelWidth: number, theme: Theme): string[] {
    const maxLines = this.maxRenderLines();
    if (lines.length <= maxLines) return lines;

    const header = lines.slice(0, 3);
    const body = lines.slice(3, -2);
    const hBar = lines[lines.length - 1] ?? theme.fg("dim", "─".repeat(panelWidth));
    const maxBodyLines = Math.max(4, maxLines - header.length - 2);
    const maxOffset = Math.max(0, body.length - maxBodyLines);
    const state = this.getState();
    const offset = Math.max(0, Math.min(state.scrollOffset, maxOffset));
    state.scrollOffset = offset;
    const hiddenAbove = offset;
    const hiddenBelow = Math.max(0, body.length - offset - maxBodyLines);
    const scrollHint = hiddenAbove || hiddenBelow
      ? `↑${hiddenAbove} ↓${hiddenBelow}  Alt+K/J scroll`
      : "Alt+C to close";

    return [
      ...header,
      ...body.slice(offset, offset + maxBodyLines),
      `  ${theme.fg("dim", truncateToWidth(scrollHint, panelWidth - 4))}`,
      hBar,
    ];
  }

  render(width: number): string[] {
    const theme = this.theme;
    const state = this.getState();
    const ctx = this.getCtx();
    const panelWidth = Math.min(36, Math.max(24, width));
    const innerWidth = panelWidth - 4;
    const pad = "  ";
    const lines: string[] = [];
    const hBar = theme.fg("dim", "─".repeat(panelWidth));

    lines.push(hBar);
    lines.push(`${pad}${theme.fg("accent", "◎ Context")}`);
    lines.push("");

    if (ctx) {
      const age = formatDuration(Date.now() - state.sessionStart);
      const active = formatDuration(state.activeMs);
      lines.push(`${pad}${theme.fg("dim", "Age:")}     ${theme.fg("muted", age)}`);
      lines.push(`${pad}${theme.fg("dim", "Active:")}  ${theme.fg("muted", active)}`);

      const contextUsage = ctx.getContextUsage();
      if (contextUsage && contextUsage.percent !== null) {
        const pct = Math.round(contextUsage.percent);
        const tokStr = contextUsage.tokens !== null
          ? `${Math.round(contextUsage.tokens / 1000)}k/${Math.round(contextUsage.contextWindow / 1000)}k`
          : "?";
        const ctxTone = pct > 80 ? "error" : pct > 60 ? "warning" : "muted";
        lines.push(`${pad}${theme.fg("dim", "Context:")} ${theme.fg(ctxTone as never, `${pct}%`)} ${theme.fg("dim", `(${tokStr})`)}`);
      }

      if (ctx.model) {
        lines.push(`${pad}${theme.fg("dim", "Model:")}   ${theme.fg("muted", ellipsizeMiddle(ctx.model.id, innerWidth - 10))}`);
      }
      lines.push("");

      const boardCounts = loadBoardCounts(ctx.cwd, state.runtime.activeSessionId);
      const activeAgent = state.runtime.activeSubagentAgent;
      const activeTask = state.runtime.activeSubagentTask;
      const activeStatus = state.runtime.activeSubagentStatus ?? "running";
      if (activeAgent || activeTask || boardCounts) {
        lines.push(`${pad}${theme.fg("accent", "-- Active Work --")}`);
        if (activeAgent) {
          const statusTone = activeStatus === "blocked" ? "error" : activeStatus === "completed" ? "success" : "muted";
          lines.push(`${pad}${theme.fg(statusTone as never, truncateToWidth(`${activeAgent} ${activeStatus}`, innerWidth))}`);
        }
        if (activeTask) {
          lines.push(`${pad}${theme.fg("muted", truncateToWidth(activeTask, innerWidth))}`);
        }
        if (boardCounts) {
          lines.push("");
          lines.push(`${pad}${theme.fg("dim", "Board:")} ${theme.fg("muted", truncateToWidth(formatBoardCounts(boardCounts), innerWidth - 7))}`);
        }
        lines.push("");
      }
    }

    lines.push(`${pad}${theme.fg("accent", "-- Files Changed --")}`);
    if (state.fileChanges.length === 0) {
      lines.push(`${pad}${theme.fg("dim", "  (none yet)")}`);
    } else {
      const seen = new Map<string, FileChange>();
      for (const change of state.fileChanges) seen.set(change.path, change);
      const deduped = [...seen.values()].slice(-12);

      for (const change of deduped) {
        const icon = change.action === "+" ? theme.fg("success", "+") : theme.fg("warning", "M");
        const diff = formatDiff(change, theme);
        const diffWidth = visibleWidth(diff);
        const pathWidth = Math.max(8, innerWidth - 5 - diffWidth);
        const displayPath = ellipsizeMiddle(formatDisplayPath(change.path, ctx?.cwd), pathWidth);
        const spacer = diff ? " ".repeat(Math.max(1, innerWidth - 4 - visibleWidth(displayPath) - diffWidth)) : "";
        lines.push(`${pad} ${icon}  ${truncateToWidth(displayPath, pathWidth)}${spacer}${diff}`);
      }
      if (seen.size > 12) {
        lines.push(`${pad}    ${theme.fg("dim", `... +${seen.size - 12} more`)}`);
      }
    }
    lines.push("");

    lines.push(`${pad}${theme.fg("accent", "-- Tool Activity --")}`);
    const toolEntries = Object.entries(state.toolUses).sort((a, b) => b[1] - a[1]);
    if (toolEntries.length === 0) {
      lines.push(`${pad}${theme.fg("dim", "  (no tools used)")}`);
    } else {
      for (const [tool, count] of toolEntries.slice(0, 8)) {
        lines.push(`${pad}  ${theme.fg("success", "✓")} ${tool} ${theme.fg("dim", `(${count})`)}`);
      }
    }
    lines.push("");

    lines.push(`${pad}${theme.fg("dim", "(Alt+C to close)")}`);
    lines.push(hBar);
    return this.applyViewport(lines, panelWidth, theme);
  }
}

export class TakomiContextPanel {
  private state = createEmptyState();
  private visible = false;
  private overlayHandle?: OverlayHandle;
  private requestRender?: () => void;
  private lastCtx?: ExtensionContext;

  getState(): ContextPanelState {
    return this.state;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setRuntimeState(runtime: ContextRuntimeState): void {
    this.state.runtime = { ...this.state.runtime, ...runtime };
    this.requestRender?.();
  }

  trackFileChange(change: FileChange): void {
    this.state.fileChanges.push({ ...change, timestamp: change.timestamp || Date.now() });
    this.state.lastToolAt = Date.now();
    this.requestRender?.();
  }

  trackActivity(timestamp = Date.now()): void {
    const previous = this.state.lastActivityAt;
    const delta = timestamp - previous;
    if (delta > 0 && delta <= ACTIVE_GAP_THRESHOLD_MS) this.state.activeMs += delta;
    this.state.lastActivityAt = Math.max(previous, timestamp);
    this.requestRender?.();
  }

  trackToolUse(toolName: string): void {
    this.state.toolUses[toolName] = (this.state.toolUses[toolName] ?? 0) + 1;
    this.state.lastToolAt = Date.now();
    this.trackActivity(this.state.lastToolAt);
  }

  resetSession(): void {
    this.state = createEmptyState(Date.now(), this.state.runtime);
    this.requestRender?.();
  }

  scroll(delta: number): void {
    if (!this.visible) return;
    this.state.scrollOffset = Math.max(0, this.state.scrollOffset + delta);
    this.requestRender?.();
  }

  page(delta: number): void {
    this.scroll(delta * 8);
  }

  rebuildFromSession(ctx: ExtensionContext): void {
    this.lastCtx = ctx;
    const branch = ctx.sessionManager.getBranch() as Array<{
      type?: string;
      timestamp?: string;
      message?: {
        role?: string;
        content?: unknown;
        toolCallId?: string;
        toolName?: string;
        timestamp?: number;
      };
    }>;
    const activityTimestamps = branch.map(toTimestampMs).filter((value): value is number => typeof value === "number");
    const firstTs = activityTimestamps[0];
    const next = createEmptyState(firstTs ?? Date.now(), this.state.runtime);
    next.activeMs = calculateActiveMs(activityTimestamps);
    next.lastActivityAt = activityTimestamps.at(-1) ?? next.sessionStart;
    const toolCalls = new Map<string, { name: string; input: ToolCallInput }>();

    for (const entry of branch) {
      const message = entry.message;
      if (!message) continue;
      if (message.role === "assistant" && Array.isArray(message.content)) {
        for (const block of message.content) {
          const record = asRecord(block);
          if (record.type !== "toolCall") continue;
          const id = typeof record.id === "string" ? record.id : undefined;
          const name = typeof record.name === "string" ? record.name : undefined;
          if (!id || !name) continue;
          toolCalls.set(id, { name, input: asRecord(record.arguments) });
        }
      }
      if (message.role !== "toolResult" || !message.toolName) continue;
      next.toolUses[message.toolName] = (next.toolUses[message.toolName] ?? 0) + 1;
      next.lastToolAt = toTimestampMs(entry) ?? next.lastToolAt;
      const input = message.toolCallId ? toolCalls.get(message.toolCallId)?.input : undefined;
      if (input) {
        const change = changeFromTool(message.toolName, input);
        if (change) next.fileChanges.push({ ...change, timestamp: toTimestampMs(entry) ?? change.timestamp });
      }
    }

    this.state = next;
    this.requestRender?.();
  }

  refresh(): void {
    this.requestRender?.();
  }

  toggle(ctx: ExtensionContext): void {
    this.lastCtx = ctx;
    if (this.visible) this.hide();
    else this.show(ctx);
  }

  show(ctx: ExtensionContext): void {
    this.lastCtx = ctx;
    if (!ctx.hasUI) return;
    if (this.visible) {
      this.requestRender?.();
      return;
    }
    this.visible = true;

    void ctx.ui.custom<void>(
      (tui, theme, _keybindings, _done) => {
        this.requestRender = () => tui.requestRender();
        return new ContextPanelComponent(theme, () => this.state, () => this.lastCtx);
      },
      {
        overlay: true,
        overlayOptions: {
          width: 36,
          maxHeight: "100%",
          anchor: "top-right",
          margin: { right: 1, top: 1, bottom: 3 },
          nonCapturing: true,
          visible: (termWidth) => termWidth >= 100,
        },
        onHandle: (handle) => {
          this.overlayHandle = handle;
        },
      },
    ).then(() => {
      this.visible = false;
      this.overlayHandle = undefined;
      this.requestRender = undefined;
    });
  }

  hide(): void {
    this.visible = false;
    this.overlayHandle?.hide();
    this.overlayHandle = undefined;
    this.requestRender = undefined;
  }
}

export function wireContextPanel(pi: ExtensionAPI, panel: TakomiContextPanel): void {
  const pendingWriteActions = new Map<string, "M" | "+">();

  pi.on("tool_call", (event, ctx) => {
    if (event.toolName !== "write") return;
    const input = asRecord(event.input);
    const filePath = normalizeToolPath(input);
    if (!filePath) return;
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(ctx.cwd, filePath);
    try {
      accessSync(absolute);
      statSync(absolute);
      pendingWriteActions.set(event.toolCallId, "M");
    } catch {
      pendingWriteActions.set(event.toolCallId, "+");
    }
  });

  pi.on("tool_result", (event) => {
    const toolName = event.toolName;
    panel.trackToolUse(toolName);

    const input = asRecord(event.input);
    const actionOverride = toolName === "write" ? pendingWriteActions.get(event.toolCallId) : undefined;
    pendingWriteActions.delete(event.toolCallId);
    const change = changeFromTool(toolName, input, actionOverride);
    if (change) panel.trackFileChange(change);
  });

  pi.on("message_end", (event) => {
    const message = (event as { message?: { role?: string } }).message;
    if (message?.role === "toolResult") return;
    panel.trackActivity(Date.now());
  });

  pi.on("turn_end", () => {
    panel.refresh();
  });

  pi.on("session_start", (_event, ctx) => {
    panel.rebuildFromSession(ctx);
  });

  pi.registerShortcut("alt+c", {
    description: "Toggle Takomi context panel",
    handler: async (ctx) => {
      panel.toggle(ctx);
    },
  });

  pi.registerShortcut("alt+k", {
    description: "Scroll Takomi context panel up",
    handler: async () => {
      panel.scroll(-1);
    },
  });

  pi.registerShortcut("alt+j", {
    description: "Scroll Takomi context panel down",
    handler: async () => {
      panel.scroll(1);
    },
  });

  pi.registerShortcut("alt+shift+k", {
    description: "Page Takomi context panel up",
    handler: async () => {
      panel.page(-1);
    },
  });

  pi.registerShortcut("alt+shift+j", {
    description: "Page Takomi context panel down",
    handler: async () => {
      panel.page(1);
    },
  });
}

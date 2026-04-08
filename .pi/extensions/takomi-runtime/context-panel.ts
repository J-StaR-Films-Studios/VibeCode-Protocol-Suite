/**
 * Takomi Context Panel - right-side overlay showing session context.
 *
 * Tracks file edits, tool usage, and Takomi runtime metadata.
 * Toggled with Alt+C or /takomi-context.
 */

import type { ExtensionAPI, ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { ellipsizeMiddle, formatDuration, truncateToWidth } from "./shared";

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

export type FileEdit = {
  path: string;
  action: "M" | "+" | "R";
  timestamp: number;
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
  planMode?: boolean;
};

export type ContextPanelState = {
  fileEdits: FileEdit[];
  toolUses: ToolUseCount;
  sessionStart: number;
  lastToolAt: number;
  runtime: ContextRuntimeState;
};

function createEmptyState(): ContextPanelState {
  return {
    fileEdits: [],
    toolUses: {},
    sessionStart: Date.now(),
    lastToolAt: 0,
    runtime: {},
  };
}

class ContextPanelComponent implements Component {
  constructor(
    private readonly theme: Theme,
    private readonly getState: () => ContextPanelState,
    private readonly getCtx: () => ExtensionContext | undefined,
  ) {}

  invalidate(): void {}

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
      const elapsed = formatDuration(Date.now() - state.sessionStart);
      const runtimeLabel = [
        state.runtime.role ?? "agent",
        state.runtime.stage ?? "-",
      ].join(" · ");

      lines.push(`${pad}${theme.fg("muted", runtimeLabel)}`);
      lines.push(`${pad}${theme.fg("dim", "Session:")} ${theme.fg("muted", elapsed)}`);

      if (state.runtime.workflow) {
        lines.push(`${pad}${theme.fg("dim", "Flow:")}    ${theme.fg("muted", truncateToWidth(state.runtime.workflow, innerWidth - 10))}`);
      }
      if (state.runtime.activeSessionId) {
        lines.push(`${pad}${theme.fg("dim", "ID:")}      ${theme.fg("muted", ellipsizeMiddle(state.runtime.activeSessionId, innerWidth - 10))}`);
      }

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

      const modeFlags = [
        state.runtime.autoOrch ? "auto" : "manual",
        state.runtime.planMode ? "plan" : "direct",
      ].join(" | ");
      lines.push(`${pad}${theme.fg("dim", "Mode:")}    ${theme.fg("muted", modeFlags)}`);
      lines.push("");
    }

    lines.push(`${pad}${theme.fg("accent", "-- Files Modified --")}`);
    if (state.fileEdits.length === 0) {
      lines.push(`${pad}${theme.fg("dim", "  (none yet)")}`);
    } else {
      const seen = new Map<string, FileEdit>();
      for (const edit of state.fileEdits) seen.set(edit.path, edit);
      const deduped = [...seen.values()].slice(-12);

      for (const edit of deduped) {
        const icon = edit.action === "+" ? theme.fg("success", "+") : edit.action === "R" ? theme.fg("muted", "R") : theme.fg("warning", "M");
        const displayPath = ellipsizeMiddle(edit.path.replace(/\\/g, "/"), innerWidth - 4);
        lines.push(`${pad} ${icon}  ${truncateToWidth(displayPath, innerWidth - 4)}`);
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
    return lines;
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
    this.state.runtime = { ...runtime };
    this.requestRender?.();
  }

  trackFileEdit(filePath: string, action: "M" | "+" | "R"): void {
    this.state.fileEdits.push({ path: filePath, action, timestamp: Date.now() });
    this.state.lastToolAt = Date.now();
    this.requestRender?.();
  }

  trackToolUse(toolName: string): void {
    this.state.toolUses[toolName] = (this.state.toolUses[toolName] ?? 0) + 1;
    this.state.lastToolAt = Date.now();
    this.requestRender?.();
  }

  resetSession(): void {
    this.state = createEmptyState();
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
          maxHeight: "70%",
          anchor: "right-center",
          margin: { right: 1, top: 2, bottom: 3 },
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
  pi.on("tool_result", (event) => {
    const toolName = event.toolName;
    panel.trackToolUse(toolName);

    if (toolName === "edit" || toolName === "write" || toolName === "read") {
      const input = event.input as { file_path?: string; filePath?: string };
      const filePath = input.file_path ?? input.filePath;
      if (filePath) {
        const action = toolName === "write" ? "+" : toolName === "read" ? "R" : "M";
        panel.trackFileEdit(filePath, action);
      }
    }
  });

  pi.on("turn_end", () => {
    panel.refresh();
  });

  pi.on("session_start", () => {
    panel.resetSession();
  });

  pi.registerCommand("takomi-context", {
    description: "Toggle the Takomi context panel (files edited, tool activity)",
    handler: async (_args, ctx) => {
      panel.toggle(ctx);
      ctx.ui.notify(`Context panel ${panel.isVisible() ? "opened" : "closed"}`, "info");
    },
  });

  pi.registerShortcut("alt+c", {
    description: "Toggle Takomi context panel",
    handler: async (ctx) => {
      panel.toggle(ctx);
    },
  });
}

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import {
  FullscreenSubagentComponent,
  renderSubagentStatus,
  renderSubagentWidget,
} from "./subagent-render";
import { appendLiveLogChunk } from "./shared";
import type {
  SubagentFocusDirection,
  SubagentViewMode,
  TakomiSubagentController,
  TakomiSubagentRenderEntry,
  TakomiSubagentRenderState,
  TakomiSubagentRun,
  TakomiSubagentRunInit,
  TakomiSubagentRunPatch,
} from "./subagent-types";

const SUBAGENT_UI_KEY = "takomi-subagent";
const SUBAGENT_WIDGET_OPTIONS = { placement: "belowEditor" as const };
const LEGACY_SUBAGENT_CHROME_ENABLED = false;

class TakomiSharedSubagentController implements TakomiSubagentController {
  private readonly runs = new Map<string, TakomiSubagentRun>();
  private focusedRunKey?: string;
  private lastCtx?: ExtensionContext;
  private viewMode: SubagentViewMode = "compact";
  private lastNonFullscreenMode: Exclude<SubagentViewMode, "fullscreen"> = "compact";
  private fullscreenActive = false;
  private fullscreenDismiss?: () => void;
  private fullscreenRequestRender?: () => void;

  hasRuns(): boolean {
    return this.runs.size > 0;
  }

  getStatusSummary(): string {
    const runs = this.getOrderedRuns();
    if (runs.length === 0) return "No Takomi subagents are active.";
    const counts = runs.reduce<Record<string, number>>((acc, run) => {
      const status = run.boardTaskStatus ?? run.status;
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const focused = this.getFocusedRun();
    const parts = ["running", "in-progress", "completed", "blocked", "pending"]
      .map((status) => counts[status] ? `${status}:${counts[status]}` : "")
      .filter(Boolean);
    return [
      `Takomi subagents: ${runs.length}${parts.length ? ` (${parts.join(", ")})` : ""}.`,
      focused ? `Focused: ${focused.agent} | ${focused.taskLabel} | ${focused.model ?? "default model"} | thinking=${focused.thinking ?? "default"}.` : "",
    ].filter(Boolean).join("\n");
  }

  getViewMode(): SubagentViewMode {
    return this.viewMode;
  }

  async start(ctx: ExtensionContext, state: TakomiSubagentRunInit, runKey?: string): Promise<void> {
    const now = Date.now();
    const resolvedRunKey = runKey ?? state.conversationId ?? `${state.agent}-${now}`;
    const parentRunKey = state.parentRunKey ?? (state.parentTaskId ? this.getKnownParentRunKey(state.parentTaskId) : undefined);
    this.runs.set(resolvedRunKey, {
      ...state,
      runKey: resolvedRunKey,
      parentRunKey,
      logs: [...(state.logs ?? [])].slice(-60),
      status: state.status ?? "running",
      startedAt: now,
      updatedAt: now,
    });
    this.focusedRunKey = resolvedRunKey;
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async update(ctx: ExtensionContext, patch: TakomiSubagentRunPatch, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey, patch);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    this.runs.set(resolvedRunKey, this.mergeRun(current, patch));
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async appendLog(ctx: ExtensionContext, chunk: string, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    const logs = appendLiveLogChunk(current.logs, chunk);
    if (logs.length === current.logs.length && logs.at(-1) === current.logs.at(-1)) return;
    this.runs.set(resolvedRunKey, {
      ...current,
      logs,
      updatedAt: Date.now(),
    });
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async complete(ctx: ExtensionContext, patch?: TakomiSubagentRunPatch, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey, patch);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    this.runs.set(resolvedRunKey, this.mergeRun(current, { ...patch, status: "completed" }));
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  async block(ctx: ExtensionContext, patch?: TakomiSubagentRunPatch, runKey?: string): Promise<void> {
    const resolvedRunKey = this.resolveRunKey(runKey, patch);
    if (!resolvedRunKey) return;
    const current = this.runs.get(resolvedRunKey);
    if (!current) return;
    this.runs.set(resolvedRunKey, this.mergeRun(current, { ...patch, status: "blocked" }));
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  reset(ctx?: ExtensionContext): void {
    this.runs.clear();
    this.focusedRunKey = undefined;
    if (ctx) this.lastCtx = ctx;
    this.dismissFullscreen();
    const targetCtx = ctx ?? this.lastCtx;
    if (!targetCtx?.hasUI) return;
    targetCtx.ui.setStatus(SUBAGENT_UI_KEY, undefined);
    targetCtx.ui.setWidget(SUBAGENT_UI_KEY, undefined);
  }

  refresh(): void {
    if (this.lastCtx) this.refreshWithContext(this.lastCtx);
  }

  refreshWithContext(ctx: ExtensionContext): void {
    this.lastCtx = ctx;
    this.syncChrome(ctx);
  }

  cycleFocus(direction: SubagentFocusDirection, ctx?: ExtensionContext): boolean {
    const ordered = this.getOrderedRuns();
    if (ordered.length <= 1) return false;
    const currentIndex = Math.max(0, ordered.findIndex((run) => run.runKey === this.focusedRunKey));
    const delta = direction === "next" ? 1 : -1;
    this.focusedRunKey = ordered[(currentIndex + delta + ordered.length) % ordered.length]?.runKey;
    const targetCtx = ctx ?? this.lastCtx;
    if (targetCtx) this.syncChrome(targetCtx);
    return true;
  }

  setViewMode(mode: SubagentViewMode, ctx?: ExtensionContext): SubagentViewMode | undefined {
    if (!this.hasRuns()) return undefined;
    this.viewMode = mode;
    if (mode !== "fullscreen") this.lastNonFullscreenMode = mode;
    const targetCtx = ctx ?? this.lastCtx;
    if (targetCtx) this.syncChrome(targetCtx);
    return this.viewMode;
  }

  cycleViewMode(ctx?: ExtensionContext): SubagentViewMode | undefined {
    if (!this.hasRuns()) return undefined;
    const nextMode = this.viewMode === "compact"
      ? "expanded"
      : this.viewMode === "expanded"
        ? "fullscreen"
        : "compact";
    return this.setViewMode(nextMode, ctx);
  }

  closeFullscreen(ctx?: ExtensionContext): SubagentViewMode {
    this.viewMode = this.lastNonFullscreenMode;
    const targetCtx = ctx ?? this.lastCtx;
    if (targetCtx) this.syncChrome(targetCtx);
    return this.viewMode;
  }

  getKnownParentRunKey(parentTaskId: string): string | undefined {
    if (this.runs.has(parentTaskId)) return parentTaskId;
    for (const run of this.runs.values()) {
      if (run.conversationId === parentTaskId) return run.runKey;
    }
    return undefined;
  }

  private mergeRun(current: TakomiSubagentRun, patch?: TakomiSubagentRunPatch): TakomiSubagentRun {
    const nextLogs = patch?.logs ? [...current.logs, ...patch.logs].slice(-60) : current.logs;
    const parentRunKey = patch?.parentRunKey
      ?? current.parentRunKey
      ?? (patch?.parentTaskId ? this.getKnownParentRunKey(patch.parentTaskId) : undefined)
      ?? (current.parentTaskId ? this.getKnownParentRunKey(current.parentTaskId) : undefined);
    return {
      ...current,
      ...patch,
      parentRunKey,
      logs: nextLogs,
      updatedAt: Date.now(),
    };
  }

  private syncChrome(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;

    if (!LEGACY_SUBAGENT_CHROME_ENABLED) {
      ctx.ui.setStatus(SUBAGENT_UI_KEY, undefined);
      ctx.ui.setWidget(SUBAGENT_UI_KEY, undefined);
      this.dismissFullscreen();
      return;
    }

    const renderState = this.buildRenderState();
    if (!renderState.focusedRun) {
      ctx.ui.setStatus(SUBAGENT_UI_KEY, undefined);
      ctx.ui.setWidget(SUBAGENT_UI_KEY, undefined);
      this.dismissFullscreen();
      return;
    }

    ctx.ui.setStatus(SUBAGENT_UI_KEY, renderSubagentStatus(ctx.ui.theme, renderState));

    if (this.viewMode === "fullscreen") {
      ctx.ui.setWidget(SUBAGENT_UI_KEY, undefined);
      if (!this.fullscreenActive) this.showFullscreen(ctx);
      else this.fullscreenRequestRender?.();
      return;
    }

    if (this.fullscreenActive) this.dismissFullscreen();
    ctx.ui.setWidget(SUBAGENT_UI_KEY, renderSubagentWidget(ctx.ui.theme, renderState), SUBAGENT_WIDGET_OPTIONS);
  }

  private showFullscreen(ctx: ExtensionContext): void {
    if (!ctx.hasUI || this.fullscreenActive) return;
    this.fullscreenActive = true;
    void ctx.ui.custom<void>(
      (tui, theme, _keybindings, done) => {
        this.fullscreenDismiss = () => done();
        this.fullscreenRequestRender = () => tui.requestRender();
        return new FullscreenSubagentComponent(
          tui,
          theme,
          () => this.buildRenderState(),
          () => {
            this.viewMode = this.lastNonFullscreenMode;
            this.dismissFullscreen();
          },
          () => {
            this.viewMode = "compact";
            this.lastNonFullscreenMode = "compact";
            this.dismissFullscreen();
          },
          () => {
            this.cycleFocus("next", ctx);
          },
          () => {
            this.cycleFocus("prev", ctx);
          },
        );
      },
      {
        overlay: true,
        overlayOptions: {
          width: "88%",
          maxHeight: 20,
          anchor: "center",
        },
      },
    ).then(() => {
      this.fullscreenActive = false;
      this.fullscreenDismiss = undefined;
      this.fullscreenRequestRender = undefined;
      const targetCtx = this.lastCtx;
      if (targetCtx?.hasUI) this.syncChrome(targetCtx);
    });
  }

  private dismissFullscreen(): void {
    if (this.fullscreenDismiss) this.fullscreenDismiss();
    this.fullscreenDismiss = undefined;
    this.fullscreenRequestRender = undefined;
    this.fullscreenActive = false;
  }

  private resolveRunKey(runKey?: string, patch?: TakomiSubagentRunPatch): string | undefined {
    const explicit = runKey ?? patch?.conversationId;
    if (explicit) return this.runs.has(explicit) ? explicit : undefined;
    if (this.focusedRunKey && this.runs.has(this.focusedRunKey)) return this.focusedRunKey;
    return this.getOrderedRuns()[0]?.runKey;
  }

  private getOrderedRuns(): TakomiSubagentRun[] {
    return [...this.runs.values()].sort((a, b) => {
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.startedAt - a.startedAt;
    });
  }

  private getFocusedRun(): TakomiSubagentRun | undefined {
    if (this.focusedRunKey && this.runs.has(this.focusedRunKey)) {
      return this.runs.get(this.focusedRunKey);
    }
    const fallback = this.getOrderedRuns()[0];
    if (fallback) this.focusedRunKey = fallback.runKey;
    return fallback;
  }

  private buildRenderState(): TakomiSubagentRenderState {
    const orderedRuns = this.getOrderedRuns();
    const focusedRun = this.getFocusedRun();
    const focusPosition = focusedRun ? Math.max(1, orderedRuns.findIndex((run) => run.runKey === focusedRun.runKey) + 1) : 0;
    const activePathRuns = focusedRun ? this.getActivePathRuns(focusedRun.runKey) : [];
    const activePathKeys = new Set(activePathRuns.map((run) => run.runKey));
    const activePath = activePathRuns.map((run, index) => ({
      run,
      depth: index,
      relation: index === activePathRuns.length - 1 ? "focused" : "ancestor",
    } satisfies TakomiSubagentRenderEntry));
    const peerRuns = orderedRuns
      .filter((run) => !activePathKeys.has(run.runKey))
      .map((run) => ({ run, depth: 0, relation: "peer" } satisfies TakomiSubagentRenderEntry));

    const compactRuns: TakomiSubagentRenderEntry[] = [];
    const ancestorEntries = activePath.slice(0, -1).slice(-2);
    compactRuns.push(...ancestorEntries);
    const focusedEntry = activePath.at(-1);
    if (focusedEntry) compactRuns.push(focusedEntry);
    for (const peer of peerRuns) {
      if (compactRuns.length >= 3) break;
      compactRuns.push(peer);
    }

    return {
      mode: this.viewMode,
      activeCount: orderedRuns.length,
      focusPosition,
      focusedRun,
      activePath,
      peerRuns,
      compactRuns,
    };
  }

  private getActivePathRuns(runKey: string): TakomiSubagentRun[] {
    const path: TakomiSubagentRun[] = [];
    const seen = new Set<string>();
    let current = this.runs.get(runKey);
    while (current && !seen.has(current.runKey)) {
      seen.add(current.runKey);
      path.unshift(current);
      const parentRunKey = current.parentRunKey
        ?? (current.parentTaskId ? this.getKnownParentRunKey(current.parentTaskId) : undefined);
      current = parentRunKey ? this.runs.get(parentRunKey) : undefined;
    }
    return path;
  }
}

const controller = new TakomiSharedSubagentController();

export function getTakomiSubagentController(): TakomiSubagentController {
  return controller;
}

# Takomi Startup Optimization Notes

## Context

Takomi startup currently feels slow, especially from global config. Initial investigation found that the `takomi` wrapper was doing blocking preflight work before Pi became usable.

## Completed Now

- Optimized `src/pi-harness.js` so normal `takomi` launch no longer runs full `takomi doctor`-style inspection.
- Avoided blocking `pi --version` during normal Takomi startup.
- Replaced hot-path `where pi` shelling with direct PATH scanning first.
- Added delayed Pi version check after `session_start` via Takomi runtime.
- Patched installed global runtime at `C:\Users\johno\.pi\agent\extensions\takomi-runtime\index.ts` for immediate local effect.

## Startup Strategy To Revisit

Use phased extension loading instead of loading everything eagerly before the user sees the harness.

### Phase 1: Critical Before Usable

Keep these available before first prompt:

- provider/model routing extensions, especially `oauth-router`
- lightweight Takomi runtime state
- command/tool registration stubs
- anything that affects system prompt construction before agent turns

### Phase 2: Deferred / Lazy Work

Extensions should load their surface area fast, then defer expensive work until needed:

- run heavy scans after `session_start` with a delay
- load engines/modules only on first tool invocation
- perform network checks after UI is ready
- cache file discovery results where possible

### Candidate Optimizations

1. Keep `oauth-router` and core Takomi runtime upfront.
2. Make `takomi-context-manager` avoid heavy discovery until first `before_agent_start` or first relevant tool call.
3. Make `takomi-subagents` register the tool upfront but lazy-load the `pi-subagents` engine only on first dispatch.
4. Review optional global packages:
   - `pi-chrome`
   - `pi-markdown-preview`
   - `context-mode`
   - `@juicesharp/rpiv-todo`
   - `@juicesharp/rpiv-ask-user-question`
5. Consider moving optional packs out of global config or making them project-only.
6. Add startup profiling diagnostics to measure per-extension/package cost.

## Proposed Diagnostic

Add a `takomi startup-profile` command or equivalent script that measures launch timing for:

- Pi baseline with `--no-extensions`
- Takomi-only extensions
- global extensions only
- project extensions only
- optional packages one-by-one

Goal: identify the actual extension/package costs before doing broader lazy-load refactors.

## Principle

Do not show the harness as ready while core tools/models are missing. Instead:

1. Boot UI fast.
2. Register lightweight extension surfaces immediately.
3. Defer optional or expensive work in the background.
4. Notify only for meaningful update/failure events.

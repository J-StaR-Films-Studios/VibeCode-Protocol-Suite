---
name: token-usage-ledger-dashboard-spec
description: Formal technical specification for the multi-model token usage scanner, rate schedule and discount engine, Takomi stats CLI, interactive TUI, local cache, and modern web dashboard.
status: ready-for-agent
version: 2.1.0
---

# Token usage ledger, Takomi stats CLI, interactive TUI, and dashboard specification

## Problem statement

Developers tracking LLM token consumption across multiple tools, IDEs, and local harnesses (Pi, Codex, Antigravity, and Takomi) face fragmented, opaque, and outdated usage accounting. Model pricing changes across calendar months, such as the GPT-5.6 Terra and Luna price reductions on July 30, 2026. Provider promotional discount periods apply retroactively or on sliding windows, such as temporary rates for Gemini 3.8 Flash and 3.7 Flash through 2026. Newly released models, such as GPT-6 Astra, Gemini 3.8 Flash, Luna, and Terra, lack standardized pricing across tools.

Furthermore, discrepancies existed between terminal reporting in the Takomi CLI (`takomi stats`) and the web dashboard. The CLI lacked monthly rollup views and configurable discount ingestion. An early experimental interactive terminal interface hijacked standard command output into a rigid ASCII box frame (`│ ... │`) with fractured borders in Windows Terminal and colliding column text, replacing the clean, spacious terminal dashboard users relied on. Repeating cold scans across more than 1,400 session files took over 20 seconds, creating noticeable lag.

Meanwhile, the global web dashboard was sluggish and cluttered. Loading hundreds of megabytes of raw JSON events caused page freezes. Navigation elements scrolled off screen instead of staying pinned. Session lists suffered from artificial truncation that hid dozens of active runs, while drilldowns stripped away project context. Crucial inspection tools were split across disconnected modals with empty visual real estate and clumsy native scrollbars. Crucially, the developer required a strict conceptual separation between the global token dashboard (which tracks all harnesses across the entire system) and the Takomi stats CLI, TUI, and web bridge (which strictly track Takomi-owned session and subagent usage).

## Solution

A unified token tracking architecture spanning two decoupled systems:

1. **The Takomi stats engine, cache, and terminal interface** (in `VibeCode-Protocol-Suite`):
   - **Default CLI dashboard**: Running `takomi stats` prints a clean, spacious, non-interactive terminal dashboard directly to stdout. It displays a rounded profile card, real 26-week activity heatmap, highlights, signals, ranked model bars, ranked project bars, and recent sessions in under 3 seconds.
   - **Incremental session cache**: An mtime-indexed disk cache stored at `~/.pi/takomi/cache/stats-cache.json` eliminates repeated JSONL parsing. It preserves cached session metrics across consecutive runs, dropping scan duration across 1,470+ sessions from 23 seconds to under 3 seconds.
   - **Interactive TUI**: An opt-in interactive terminal user interface launched strictly via `-i`, `--interactive`, `--tui`, or `-w` (`--watch`). It uses the same borderless, open design system as the static dashboard. It provides five keyboard-navigable tabs: Overview (with 26-week heatmap or 30-day sparkline volume bars), Projects catalog (with two-column live project dossier), Sessions ledger (with turn-by-turn step inspector), Models and rate schedules (with monthly audit summaries), and a live active session watcher.
   - **Standalone Takomi web bridge**: An optional lightweight local web server (`takomi stats --web`, port 8766) that renders Takomi-specific session analytics without mixing external global system logs.

2. **The global token usage web dashboard** (in `token-usage-dashboard`):
   - A multi-tool browser dashboard that scans Pi sessions, Antigravity workspaces, and Codex runs across the developer's entire workstation.
   - An incremental compiler that emits an enriched, lightweight summary payload rendering in under 20 milliseconds, alongside full event logs loaded in the background on demand.
   - Four clean views (Overview, Trends, Models, and Sessions) with dark and light theme switching.
   - Full retention of all sessions across all projects with progressive infinite scrolling, project-grouped navigation with sticky context, and a unified full-screen inspection modal with interactive timeline scrubbing.
   - Standalone preservation of the legacy dashboard at `/legacy`.

Across both systems, a shared pricing and rate-schedule model handles time-delimited pricing cutoffs, canonical model name resolution, and monthly or date-ranged discount calculations.

## User stories

### Takomi stats CLI, caching, and rate schedules
1. As a CLI user, I want running `takomi stats` without flags to print the clean terminal dashboard directly to stdout, so that I can immediately review my usage summary in my terminal history without entering an interactive screen buffer.
2. As a CLI user, I want `takomi stats` to track monthly token usage totals and estimated costs alongside daily stats, so that I can audit monthly spending cycles directly from the terminal.
3. As a CLI user, I want focused monthly table views via `takomi stats --view=months` or `takomi stats --view=monthly`, so that I can see a clean chronological breakdown of monthly tokens, cost, and call volume.
4. As a CLI user, I want `takomi stats` to recognize `openai-codex/gpt-6-astra`, so that Astra sessions are accurately priced using its canonical rates ($10.00/M input, $1.00/M cache read, $50.00/M output).
5. As a CLI user, I want rate schedules with date thresholds, so that GPT-5.6 Luna and Terra usage prior to July 30, 2026 uses legacy rates while subsequent usage uses reduced current rates.
6. As a CLI user, I want promotional pricing schedules, so that Gemini 3.8 Flash and 3.7 Flash use temporary promotional rates ($0.75/M input, $0.075/M cache, $3.75/M output) through 2026 before resetting to standard rates.
7. As a CLI user, I want configurable discount definitions supported in `.takomi/stats.local.json`, `.takomi-stats.local.json`, or CLI options, so that promotional credits or percentage discounts are calculated accurately.
8. As a developer, I want incremental file modification caching at `~/.pi/takomi/cache/stats-cache.json`, so that repeated CLI runs scan 1,470+ sessions in under 3 seconds rather than re-parsing raw JSONL files from scratch.
9. As a developer, I want pricing and collection logic synchronized across both `src/takomi-stats.js` and `.pi/extensions/takomi-runtime/takomi-stats.js`, so that runtime extension behavior matches the core package.
10. As a developer, I want automated regression tests in `scripts/test-regressions.js` verifying rate changes, monthly grouping, cache persistence, cache hits, runtime parity, and CLI flag behavior.

### Takomi interactive TUI and live watcher
11. As a CLI user, I want an optional interactive mode via `takomi stats -i` (or `--interactive`, `--tui`), so that I can explore projects, sessions, models, and turn-by-turn inspector views with keyboard shortcuts.
12. As a CLI user, I want the interactive TUI to match the borderless visual styling of the terminal dashboard, so that Windows Terminal and other emulators do not suffer from fractured ASCII box borders or misaligned text columns.
13. As a CLI user, I want the Overview tab in the TUI to render the real 26-week activity heatmap grid with date and month markers, so that I can visually audit my activity patterns over the last half-year.
14. As a CLI user, I want to toggle between the 26-week heatmap and a 30-day daily volume bar chart by pressing `v`, so that I can evaluate day-to-day token burns and peak days.
15. As a CLI user, I want to toggle the volume bar chart metric between token counts and dollar cost by pressing `m`, so that I can see volume vs spend trends directly in the terminal.
16. As a CLI user, I want Highlights and Signals separated with clear section headers, so that metrics and behavioral insights never collide or overlap on small terminal viewports.
17. As a CLI user, I want a Projects tab with a split-pane dossier, so that I can navigate projects with arrow keys and see spend, token totals, event counts, and top sessions for the selected project in real time.
18. As a CLI user, I want pressing `Enter` on a project in the Projects tab to open its top session in the Sessions ledger inspector, so that I can quickly drill into significant runs without hunting for session IDs.
19. As a CLI user, I want a Sessions ledger tab displaying a scrollable list of recorded runs with duration, turn count, token volume, and cost, so that I can locate and audit heavy sessions.
20. As a CLI user, I want pressing `Enter` on any session in the Sessions tab to open a turn-by-turn inspector drilldown, so that I can inspect prompt excerpts, models used, cache efficiency, and tools called for each turn.
21. As a CLI user, I want pressing `Esc` in the turn inspector to return to the sessions ledger list, so that I can resume browsing other runs smoothly.
22. As a CLI user, I want a Models & Months tab displaying current model rate schedules and monthly audit summaries, so that I can verify input, cache, and output pricing alongside monthly token totals.
23. As a CLI user, I want a live watcher mode via `takomi stats -w` (or Tab 5 in the TUI), so that I can monitor active agent turns, duration, token burn, and tool invocations in real time.
24. As a CLI user, I want pressing `s` in the TUI to exit cleanly and print the static dashboard to my terminal scrollback, so that I can capture a snapshot in my command history.
25. As a CLI user, I want an optional standalone Takomi web bridge via `takomi stats --web`, so that I can view Takomi-specific metrics in a browser without mixing external global system logs.

### Global dashboard data pipeline and performance
26. As a developer, I want token consumption scanned across Pi sessions, Antigravity workspaces, and Codex runs across my workstation, so that all my local AI spend is tracked in one central global ledger.
27. As a developer, I want the web dashboard to open in under 20 milliseconds, so that checking my daily token spend feels immediate rather than waiting for massive event payloads to parse.
28. As a developer, I want the dashboard to load lightweight pre-aggregated metrics first and fetch heavy event logs lazily in the background, so that the initial interface is usable right away.
29. As a developer, I want all modal event bindings defensively guarded, so that missing DOM nodes in deprecated templates never crash application startup or freeze initial rendering.

### Global dashboard analytics and inspection views
30. As a developer, I want an Overview tab featuring primary KPI cards (total processed tokens, estimated API cost, and session count), so that I get an instant snapshot of my current footprint.
31. As a developer, I want to toggle between Tokens and Cost on the Overview daily activity chart, so that I can evaluate both volume and financial impact over time.
32. As a developer, I want to see token composition broken down into cached input, uncached input, and output tokens, so that I can judge prompt caching efficiency.
33. As a developer, I want a Trends tab displaying volume breakdowns by tool source, so that I can see which agent harness generates the most usage.
34. As a developer, I want to toggle between daily and monthly granularity on the Trends chart, so that I can inspect both short-term bursts and long-term spending patterns.
35. As a developer, I want visible dotted vertical demarcation lines between calendar months on time charts, so that month boundaries are unmistakable when auditing billing cycles.
36. As a developer, I want a Models tab comparing cost, token volume, call counts, and share percentages per model, so that I can pinpoint expensive models and reduce unnecessary spend.
37. As a developer, I want a Sessions tab that lists every recorded session without artificial limits, so that no historical sessions are hidden from view.
38. As a developer, I want progressive infinite scrolling with explicit load footers in the sessions list, so that browsing thousands of sessions stays performant and predictable.
39. As a developer, I want to switch between an individual sessions view and a "Group by Project" view, so that I can browse runs organized by project folder.
40. As a developer, I want the project list to remain visible when selecting a project in "Group by Project", so that I do not lose my place in the repository catalog.
41. As a developer, I want a prominent project filter banner when drilling down, with single-click options to clear the filter or jump back to project groups, so that navigation is clear and reversible.
42. As a developer, I want a single unified full-screen inspection modal that merges session activity curves and raw API call logs, so that I never have to juggle separate popup drawers.
43. As a developer, I want bidirectional scrubbing between the timeline curve and the call ledger table, so that hovering over the graph auto-scrolls to and highlights the corresponding API call.
44. As a developer, I want full support for both Dark Mode and Light Mode with saved preferences, so that I can use the tool comfortably in any lighting condition.
45. As a developer, I want the original dashboard preserved on an isolated `/legacy` route, so that I can verify legacy calculations without risking breaking changes.

## Implementation decisions

### Shared pricing and rate schedule architecture
- **Model canonicalization**: Strips suffixes such as thought-level indicators (e.g. `[high]`, `[ultra]`), provider prefixes (`openai-codex/`, `google/`), and normalizes aliases to canonical IDs (`gpt-6-astra`, `gemini-3.8-flash`, `gpt-5.6-terra`, `gpt-5.6-luna`).
- **Date-bounded rate schedules**: Pricing lookup accepts an event timestamp and iterates through ordered schedule tiers. If an event occurs before an `until` threshold, it applies the historical rate; otherwise, it applies the active rate.
- **Discount rule matcher**: A discount engine checks model canonical names, month strings (`YYYY-MM`), or date spans (`start` and `end`), computing percentage reductions or promotional offsets.

```typescript
// Shared model rate schedule structure
interface RateScheduleTier {
  until?: number; // epoch ms cutoff
  price: [number, number, number]; // [input, cacheRead, output] per 1M tokens
}

const RATE_SCHEDULES: Record<string, RateScheduleTier[]> = {
  'gpt-5.6-luna': [
    { until: Date.parse('2026-07-30T00:00:00.000Z'), price: [1.00, 0.10, 6.00] },
    { price: [0.20, 0.02, 1.20] },
  ],
  'gpt-5.6-terra': [
    { until: Date.parse('2026-07-30T00:00:00.000Z'), price: [2.50, 0.25, 15.00] },
    { price: [2.00, 0.20, 12.00] },
  ],
  'gemini-3.8-flash': [
    { until: Date.parse('2027-01-01T00:00:00.000Z'), price: [0.75, 0.075, 3.75] },
    { price: [1.50, 0.15, 7.50] },
  ],
};
```

### Takomi stats CLI and caching engine
- **Default static output**: `printTakomiStats` invokes `renderTakomiStats` directly to `console.log`. Only explicit flags (`--interactive`, `-i`, `--tui`, or `--watch`, `-w`) invoke `launchTakomiTUI`.
- **Incremental disk cache**: Session scanning records file path, modification time (`mtimeMs`), size, and active discount configuration. On subsequent runs, if `mtimeMs` and discount parameters match, the pre-computed session row is returned immediately. Cache updates write out atomically.
- **Shared presentation exports**: Layout and formatting helpers (`renderProfileCard`, `heatmapGrid`, `renderHighlights`, `renderSignals`, `sectionTitle`, `cleanProjectName`, `sessionDuration`, `fmtTokens`, `fmtMoney`, `ms`) are exported directly from `src/takomi-stats.js` so both the CLI and TUI share a single canonical visual output engine.
- **Turn-by-turn inspector extractor**: `getSessionTurns` parses JSONL session streams to reconstruct individual conversational turns, calculating turn duration, input, cache, output, estimated cost, and tool call arrays.

### Takomi interactive TUI architecture
- **Borderless open design**: Outer enclosing boxes (`┌─`, `│ ... │`, `└─`) are removed entirely. Lines begin with a consistent two-space margin. Section dividers use open horizontal rules (`─`) without closing vertical borders on the right.
- **Terminal alternate buffer**: Enters the alternate screen buffer (`\x1b[?1049h`) and hides the cursor on launch. Restores standard screen buffer (`\x1b[?1049l`) and cursor on exit (`q`, `s`, `Ctrl+C`, `SIGINT`, `SIGTERM`).
- **Tabbed navigation**: Five distinct tab screens:
  - Tab 0: Overview (Activity heatmap or 30-day sparkline volume bars, Highlights, Signals).
  - Tab 1: Projects (Two-column catalog and real-time project dossier).
  - Tab 2: Sessions (Scrollable run ledger and turn-by-turn inspector drilldown).
  - Tab 3: Models & Months (Rates and monthly audit totals).
  - Tab 4: Watcher (Active session monitoring with 1-second cadence).
- **Static handoff (`s`)**: Pressing `s` exits the alternate screen buffer and prints the complete static dashboard directly into the shell scrollback history.

### Dashboard web application (`token-usage-dashboard`)
- **Two-tier data distribution**: `data/usage-summary.json` (2 to 10 MB) holds all high-level totals, model breakdowns, monthly and daily rollups, project registries, and all session entries with 30-point activity curves. `data/usage-events.json` (approximately 170 MB) holds uncompacted API call logs.
- **Client bootstrap sequence**: The frontend application loads `usage-summary.json` immediately at startup, rendering in under 20 milliseconds. The client then triggers a background lazy fetch for `usage-events.json` to hydrate deep call ledgers for active sessions.
- **Decoupled legacy route**: The legacy dashboard is preserved in its original form under `legacy.html` and served at `/legacy`.
- **Full session retention & infinite scroll**: Removed artificial slicing. Sessions render progressively in 100-card batches with an explicit load footer.
- **Independent view containers**: The application shell locks the header and sidebar in fixed viewports (`height: 100vh; overflow: hidden`). Split layout panels manage their own internal scrolling.
- **Unified session inspector**: A single full-screen modal component manages session inspection. It displays an SVG usage curve, KPI chips, and an API call ledger table with bidirectional scrubbing and auto-scrolling.

## Testing decisions

### Quality principles
Tests evaluate external observable behavior rather than private implementation details. A valid test asserts that inputs (log files, cache files, database tables, and HTTP requests) map to correct outputs (terminal tables, JSON schemas, calculated costs, and DOM state), remaining agnostic to internal variable naming or helper structure.

### Modules under test
- **Takomi stats CLI and runtime (`src/takomi-stats.js`, `.pi/extensions/takomi-runtime/takomi-stats.js`)**: Tested via `scripts/test-regressions.js`. Asserts correct canonical model resolution, rate schedule transitions, monthly grouping rollups (`byMonth`), promotional discounts (20% discount test), cache persistence at `~/.pi/takomi/cache/stats-cache.json`, cache hits on reload, runtime parity, turn-by-turn inspector extraction via `getSessionTurns`, and CLI flags (`stats`, `stats --static`, `stats --json`).
- **Takomi interactive TUI (`src/takomi-tui.js`)**: Syntax validated via Node module import checks. Tested via mock non-interactive launches verifying safe fallback to static output.
- **Usage aggregator (`scripts/refresh_usage.py` in dashboard)**: Tested via `scripts/test_refresh_usage.py`. Verifies multi-directory scanning, discount application across boundary timestamps, pricing lookups for newly added models, project path extraction, and session retention without array truncation.
- **Client controller (`assets/app.js` in dashboard)**: Tested via Node syntax checks (`node -c assets/app.js`) and DOM mock runners. Verifies syntax validity, safe initialization in the absence of optional modal markup, and deterministic handling of empty or missing datasets.

### Prior art
- `scripts/test-regressions.js` in `VibeCode-Protocol-Suite` using Node test assertions over temporary mock session directory fixtures.
- `scripts/test_refresh_usage.py` in `token-usage-dashboard` using Python's standard `unittest` framework to execute synthetic scans and validate output structures.

## Out of scope

- Merging the Takomi usage CLI/TUI and the global token usage dashboard into a single monolithic server. The Takomi stats tools strictly report Takomi and project-local Pi usage, while the global dashboard aggregates all harnesses across the entire workstation.
- Live streaming websocket connections to active running LLM sessions (scans run via periodic background sweeps, local 1-second polling in the watcher tab, or on-demand HTTP POST to `/refresh`).
- Remote multi-user authorization, role-based access control, or hosted SaaS user authentication (both tools are designed as local single-user developer utilities).
- Direct mutation or deletion of raw provider session log files from the dashboard UI or TUI.
- Arbitrary custom chart graphing builders or user-written SQL query builders.

## Further notes

- Running `node bin/takomi.js stats` prints the static dashboard instantly to terminal stdout.
- Running `node bin/takomi.js stats -i` launches the interactive TUI.
- Running `node bin/takomi.js stats -w` launches the TUI directly into the live watcher tab.
- Running `node bin/takomi.js stats --web` starts the local Takomi web dashboard on port 8766.
- The global multi-tool token dashboard runs independently via its Python server on port 8765.

# Takomi Stats Agent Handoff

## Purpose

Work on the `takomi stats` command layout and overall stats quality.

## Must-Have Files

- `src/takomi-stats.js`  
  Core collector and renderer. This is where session parsing, stats calculations, heatmap rendering, overview cards, and tables live.

- `src/cli.js`  
  CLI wiring for the stats command:
  ```js
  program.command('stats [view]')
  ```
  Only needed if adding/changing flags, views, or command options.

- `src/takomi-stats.d.ts`  
  Update if exported stats APIs or option types change.

## Useful Context Files / Data

- `package.json`  
  Scripts, bin entry, package metadata, dependencies.

- Pi session history, read-only:
  ```txt
  C:\Users\johno\.pi\agent\sessions
  ```

- Subagent run history, read-only:
  ```txt
  C:\Users\johno\.pi\agent\run-history.jsonl
  ```

## Current Working-Tree Fixes to Preserve

`src/takomi-stats.js` currently has important uncommitted fixes. Do **not** revert them.

1. Token usage is collected before message-role branches that `continue`, so assistant usage events are not skipped.
2. Active duration calculations parse timestamps into numeric milliseconds before subtraction, so `Longest Session` and `Longest Turn` render correctly.
3. Default `takomi stats` is now a clean product dashboard; dense/debug output is behind `takomi stats --full` or `takomi stats full`.
4. Source discovery now starts from global Pi sessions, follows session `cwd` values to project-local `.pi/takomi` / `.pi/agent/sessions`, and avoids broad project-folder scanning by default.
5. `takomi stats sources` is a diagnostics view and should show checked session roots plus run-history files without exposing prompts/transcripts.

## Current Implemented Layout

Default `takomi stats` should render as:

```txt
Profile card
Activity heatmap
Highlights
Signals
Models
Projects
Sessions
Tools / Subagents
Footer/privacy note
```

The old dense dashboard is preserved as:

```bash
takomi stats --full
takomi stats full
```

## Source Discovery / Local Config

Commercial-safe defaults:

- `~/.pi/agent/sessions`
- `<cwd>/.pi/agent/sessions`
- `<cwd>/.pi/takomi`
- `~/.pi/agent/run-history.jsonl`

Additional discovery:

- global Pi session logs are parsed for `cwd`
- for each discovered `cwd`, stats checks:
  - `<cwd>/.pi/takomi`
  - `<cwd>/.pi/agent/sessions`

Private/local config is supported but must not ship with the package:

- Global user config: `~/.takomi/stats.local.json`
- Optional project config: `.takomi-stats.local.json` (ignored by git)
- CLI/env overrides:
  - `--sessions-root`
  - `--project-root` (explicit broad fallback only)
  - `--run-history`
  - `--stats-config`
  - `TAKOMI_STATS_SESSION_ROOTS`
  - `TAKOMI_STATS_PROJECT_ROOTS`
  - `TAKOMI_STATS_RUN_HISTORY`
  - `TAKOMI_STATS_CONFIG`

## Calculation Notes

- Pi usage fields observed: `usage.input`, `usage.cacheRead`, `usage.output`, `usage.totalTokens`.
- For Pi, `totalTokens = input + cacheRead + output`; cache is additive, not subtracted from input.
- Costs are estimates using the local price table when model pricing is known.
- Session and turn durations are active-time estimates:
  - message gaps count only when `<= 15m`
  - tool call start/end intervals count
  - overlapping intervals are merged
- Subagent duration in the main session is represented by the elapsed `takomi_subagent` tool call wall time.
- `~/.pi/agent/run-history.jsonl` is used separately for subagent run counts and longest subagent run.

## Related External Dashboard

`C:\Users\johno\token-usage-dashboard` was also updated to use the same linked-discovery idea:

- global Pi sessions -> session `cwd` -> project-local `.pi/takomi` / `.pi/agent/sessions`
- broad `project_roots` scanning is opt-in with `project_discovery: "roots"` or `"both"`
- it now shows both:
  - `Highest Estimated-Cost Sessions`
  - `Largest Raw Usage Records`

This external dashboard is not part of the Takomi package, but it is useful reference behavior.

## Goals

- Improve the arrangement/readability of the overview cards.
- Fix labels that run together in narrow terminals.
- Review stats calculations for accuracy.
- Keep stats metadata-focused; do not expose raw prompts/transcripts.
- Preserve existing focused views:
  - `models`
  - `projects`
  - `projects-full`
  - `sessions`
  - `sessions-full`
  - `tasks`
  - `tasks-full`
  - `tools`
  - `agents`
  - `subagents`
  - `daily`
  - `sources`

## Validation Commands

Run from the repo root:

```bash
NO_COLOR=1 node bin/takomi.js stats --limit 8
NO_COLOR=1 node bin/takomi.js stats --full --limit 8
NO_COLOR=1 node bin/takomi.js stats sources
NO_COLOR=1 node bin/takomi.js stats models
NO_COLOR=1 node bin/takomi.js stats sessions
NO_COLOR=1 node bin/takomi.js stats tasks
npm test
```

To test the globally installed command after changes:

```bash
npm install -g .
takomi stats
```

## Suggested Agent Prompt

```txt
Work on the Takomi stats command layout and overall stats quality.

Primary file: src/takomi-stats.js.
CLI wiring: src/cli.js.
Do not revert current uncommitted fixes for token usage collection or active duration parsing.

Goals:
- Preserve the clean default dashboard and `--full` detailed view split.
- Keep source discovery commercial-safe: global Pi sessions -> session cwd -> project-local `.pi/takomi` / `.pi/agent/sessions`.
- Review stats calculations for accuracy, especially model switches, cache efficiency, active durations, and source diagnostics.
- Preserve existing focused views: models, projects, sessions, tasks, tools, agents, subagents, daily, sources.
- Validate with:
  NO_COLOR=1 node bin/takomi.js stats --limit 8
  NO_COLOR=1 node bin/takomi.js stats --full --limit 8
  NO_COLOR=1 node bin/takomi.js stats sources
  npm test

Session data starts from ~/.pi/agent/sessions and follows session cwd metadata to project-local Takomi metadata.
Avoid exposing raw prompts/transcripts; stats should stay metadata-focused.
```

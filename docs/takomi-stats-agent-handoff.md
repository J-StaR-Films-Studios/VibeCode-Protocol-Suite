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
2. Active duration calculations parse timestamps into numeric milliseconds before subtraction, so `Top Active Session` and `Longest Active Turn` render correctly.

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
- Improve arrangement/readability of overview cards.
- Fix labels that run together in narrow terminals.
- Review stats calculations for accuracy.
- Preserve existing focused views: models, projects, sessions, tasks, tools, agents, subagents, daily.
- Validate with:
  NO_COLOR=1 node bin/takomi.js stats --limit 8
  npm test

Session data comes from C:\Users\johno\.pi\agent\sessions.
Avoid exposing raw prompts/transcripts; stats should stay metadata-focused.
```

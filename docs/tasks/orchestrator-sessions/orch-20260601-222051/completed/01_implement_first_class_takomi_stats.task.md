# Task 01: Implement First-Class Takomi Stats

## 🔧 Agent Setup (DO THIS FIRST)
### Workflow to Follow
Takomi Build / Vibe Build.

### Prime Agent Context
Read:
- `src/cli.js`
- `.pi/extensions/takomi-runtime/commands.ts`
- `.pi/extensions/takomi-runtime/command-text.ts`
- `C:/Users/johno/token-usage-dashboard/scripts/refresh_usage.py`

### Optional Skill / Context Overlays
| Overlay | Why |
|---|---|
| Takomi runtime | Align slash command UX with existing Takomi command center. |

## Objective
Bundle a terminal-native Takomi usage dashboard directly into the project.

## Scope
- Add reusable stats collection/rendering code.
- Add standalone CLI entrypoint: `takomi stats`.
- Add Pi slash commands: `/takomi stats` and `/takomi-stats`.
- Include model/source/agent summary sections and heatmap-like activity output.

## Context
User wants a dope, detailed terminal version of the profile-style activity dashboard and explicitly wants it integrated into Takomi, not treated as a side project.

## Definition Of Done
- `node bin/takomi.js stats` renders a dashboard.
- Pi runtime command registration includes stats access.
- TypeScript project compile passes.
- Output avoids raw prompt/transcript content.

## Expected Artifacts
- `src/takomi-stats.js`
- `src/takomi-stats.d.ts`
- CLI command registration in `src/cli.js`
- slash command registration in `.pi/extensions/takomi-runtime/commands.ts`
- completion/help update in `.pi/extensions/takomi-runtime/command-text.ts`

## Verification
- `node bin/takomi.js stats --limit 2`
- `npx tsc --noEmit`

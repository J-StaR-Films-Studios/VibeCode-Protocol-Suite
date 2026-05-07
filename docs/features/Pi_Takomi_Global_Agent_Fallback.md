# Pi Takomi Global Agent Fallback

## Goal

Allow Takomi subagents to work across new projects without manually copying repo-local agent definitions into every `project/.pi/agents` folder.

The runtime should prefer project-local agent definitions when they exist, but it should fall back to the global Pi agent directory under `~/.pi/agent/agents` when a project does not define its own local agents.

## Components

### Client / Runtime
- `.pi/extensions/takomi-subagents/agents.ts`
  - discover Takomi agent definitions from both project-local and global Pi locations
  - preserve local-over-global precedence by agent name
- `.pi/extensions/takomi-subagents/index.ts`
  - continue using shared discovery so direct `takomi_subagent` runs pick up fallback agents automatically
- `.pi/extensions/takomi-runtime/index.ts`
  - continue using shared discovery so runtime-board redispatch and preferred-agent UX pick up fallback agents automatically

### Local Shell
- `scripts/sync-pi-global.ps1`
  - mirror the repo's `.pi/agents/` directory into `~/.pi/agent/agents`
  - keep the global Pi installation aligned with the repo-backed Takomi agent pack

### Docs
- `docs/features/Pi_Takomi_Global_Agent_Fallback.md`
  - document the fallback order and the managed global agent path
- `docs/features/Pi_Takomi_Global_Config_Sync.md`
  - update the bootstrap contract to include synced global agent definitions

## Data Flow

1. A Takomi command or tool needs the list of available specialist agents.
2. The shared discovery helper checks `project/.pi/agents`.
3. The helper then checks `~/.pi/agent/agents`.
4. Agent definitions are merged by name:
   - project-local agents win when names collide
   - global agents fill in missing roles when the project has no local override
5. Direct `takomi_subagent` runs and runtime-board redispatch both use the merged registry.
6. The sync script refreshes `~/.pi/agent/agents` from the repo so the global fallback stays current for future projects.

## Database Schema

No database changes.

Persistent state remains file-based:
- project-local agent definitions in `project/.pi/agents/`
- global fallback agent definitions in `~/.pi/agent/agents/`
- runtime subagent continuity logs in `project/.pi/takomi/subagents/`

## Risks / Regressions

- A global agent pack can mask missing local setup, so docs must be explicit about the fallback order.
- If a project intentionally wants different behavior, it must override the global agent by reusing the same agent name locally.
- The sync script now manages one additional global path, so reruns will replace the managed `~/.pi/agent/agents` directory.

## Acceptance Criteria

- Takomi agent discovery works when a project has no `project/.pi/agents` directory.
- Project-local agents override same-named global agents.
- The global sync script refreshes `~/.pi/agent/agents` from the repo-backed Takomi agent set.
- Direct `takomi_subagent` execution and runtime-board agent lookup both use the same merged registry.

## Implementation Notes

- The fallback is intentionally additive rather than global-only so repo-specific agent overrides remain possible.
- The managed global directory is `~/.pi/agent/agents`, not the broader `~/.pi/agent/` root.

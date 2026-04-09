# Pi Takomi Global Config Sync

## Goal

Provide a repeatable PowerShell bootstrap that mirrors the repo-backed Takomi Pi assets into the user-level Pi location under `~/.pi/` so the setup can be refreshed after edits without hand-maintaining paths.

## Components

### Local Shell
- `scripts/sync-pi-global.ps1`
  - create and refresh the user-level Pi directory structure
  - mirror the repo's Takomi runtime and subagent extension folders into `~/.pi/agent/extensions/`
  - mirror the shared prompt folder into `~/.pi/agent/prompts/`
  - sync the Takomi theme file into `~/.pi/agent/themes/`
  - mirror the shared source package into `~/.pi/src/`

### Repo Source
- `.pi/extensions/takomi-runtime/`
- `.pi/extensions/takomi-subagents/`
- `.pi/prompts/`
- `.pi/themes/takomi-noir.json`
- `src/pi-takomi-core/`

### Docs
- `docs/features/Pi_Takomi_Global_Config_Sync.md`
  - track the bootstrap contract and the rerunnable sync behavior

## Data Flow

1. The script resolves the repo root and the user profile Pi root.
2. It ensures the required `~/.pi/agent/`, `~/.pi/src/`, and child folders exist.
3. It removes any managed destination path before recreating it.
4. Directory targets are re-created as junctions pointing back into the repo.
5. The theme file is refreshed as a file-level sync so edits in the repo can be pushed back into the user-level location by rerunning the script.
6. The result is a repeatable local mirror that can be updated whenever repo assets change.

## Database Schema

No database changes.

## Risks / Regressions

- Running the script will replace the managed paths under `~/.pi/agent/` and `~/.pi/src/`.
- File symlink creation can fail on Windows if developer mode or elevated permissions are unavailable, so the theme file falls back to a direct copy.
- If the repo path changes, the script should be rerun from the cloned repo so it can resolve the new source paths correctly.

## Completion Notes

- [x] Added a rerunnable sync script for the user-level Pi config mirror.
- [x] Added a feature doc covering the bootstrap flow and managed paths.
- [ ] Verify the script on the target machine and confirm Pi reads the refreshed paths.

## Implementation Update

- The sync script is intentionally rerunnable: it removes the managed destination paths and recreates them from the repo source each time.
- Directory content is handled as junctions so the user-level mirror stays lightweight.
- The theme file uses a best-effort symlink and falls back to copy if Windows refuses the link operation.

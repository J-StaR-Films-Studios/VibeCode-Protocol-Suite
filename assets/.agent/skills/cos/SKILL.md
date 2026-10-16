---
name: cos
description: Use when the user wants to manage creative work with CreativeOS (COS), such as starting or adopting a project, syncing Obsidian notes, sorting downloads or exports, restoring archived work, reviewing storage, or asking how to use a COS command.
author: J StaR Films
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# CreativeOS CLI

Use COS for operations it already owns. Its command output is formatted for people, not a stable JSON API. Look up flags with `cos <command> --help` or `cos help <command>` instead of copying a flag list from this skill. For nested commands, use `cos storage review --help`, `cos category list --help`, and similar forms.

## Find the installation

1. Try `cos --help`. This works before first-run setup. On Windows, the installed `00_System/Bin` directory provides `cos.bat` for PowerShell/cmd and an extensionless `cos` script for Git Bash.
2. If bare `cos` is missing in this checkout, use `C:/CreativeOS/00_System/Bin/` and invoke the matching launcher by its absolute path. Do not change PATH or install software just to answer a COS request. If neither launcher exists, ask for the installation location.
3. Run `cos config show`, `cos config paths`, and `cos category list --enabled` before choosing a target. `cos config validate` returns nonzero when a configured path is missing. Check which path failed: an unplugged shuttle drive blocks `travel`, but need not block work on a valid projects path. If setup is needed, ask the user to run the interactive `cos setup`; do not overwrite configuration unattended.

Before a write, confirm that `root_path` and `projects_path` refer to the intended installation. When working from another repo, do not assume its working directory is a COS project. Use `cos <command> --help` to check arguments and expected effects. An exit code of 0 alone is not proof of success; some commands print an error and return normally. Check the reported destination and resulting files.

## Pick the command

| Need | Command | What to check before running |
|---|---|---|
| Inspect COS | `cos --help`, `cos config show`, `cos config paths`, `cos config validate`, `cos category list` | These inspect configuration; validation may fail on optional disconnected paths. |
| Review storage | `cos storage` or `cos storage review` | Uses the saved index. `--refresh` and `cos storage scan` walk projects and update the index. `cos storage schedule` changes a Windows scheduled task unless using `--status`. None of these delete project files. |
| Create a project | `cos new "Name" -c Code` | Get the category from `category list`. Confirm the destination, particularly the current directory: when run inside `projects_path`, `new` creates under that directory instead of the category folder. `--git` also initializes a repository. |
| Adopt or clone | `cos init`, `cos clone <url>` | `init` writes metadata and notes to the current folder. `clone` fetches from the network and creates a project. Confirm the folder or URL and destination first. |
| Sync notes | `cos sync --dry-run`, then `cos sync` | The preview reads project/vault notes without copying them or saving sync state; normal sync copies and may overwrite the older file, backing up a project file when needed. Review the preview before applying. |
| Open exports | `cos export` | May create per-project export folders and launch Explorer. `--simple` opens the month folder instead. |
| Organize files | `cos thumbs`, `cos clean`, `cos sort-exports` | `thumbs` copies images into the gallery. `clean` moves files from the configured Downloads folder. `sort-exports` moves items out of Exports/_Inbox. The latter two have no preview flag. |
| Move between locations | `cos travel`, `cos resurrect <name>` | `travel` copies the active project to the configured shuttle drive. `resurrect` copies an archive project into active projects and removes the archive copy after success. Check both paths and get explicit approval for the move. |
| Change configuration | `cos setup`, `cos config edit`, `cos category add/edit/remove` | These change persisted settings or category definitions; `setup --reset` deletes config files. Use only for an explicitly requested change and preserve existing settings. |
| Open the app | `cos gui`, `cos app` | Starts a local UI process; use only if the user wants the UI. |

Read `C:/CreativeOS/USER MANUAL.md` only when you need workflow details beyond `--help`. The command implementation under `C:/CreativeOS/00_System/Scripts/cos/commands/` is the source of truth if documentation and observed behavior disagree.

## Finish the task

For a requested write, report the command, the destination, and what changed. If a preview, validation, or command fails, stop and explain the failure rather than trying a different target. Do not treat `--dry-run` as a global COS flag: it is supported for `sync`, not for file-moving commands.

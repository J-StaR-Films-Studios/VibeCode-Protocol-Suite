---
description: Manage git worktrees for parallel agent development (Create, Sync, Remove).
---

# Git Worktree Workflow

Use this workflow to manage parallel development environments (worktrees) without manual path juggling.

## 1. Status Check
First, display the current landscape of branches and worktrees.
```bash
git worktree list
git branch --list
```

## 2. Choose an Action
Ask the user to select an operation:

- **[NEW] Create Agent Environment**: Spin up a new isolated agent.
- **[SYNC] Synchronize Agents**: Update worktrees with the latest from `main`.
- **[KILL] Teardown Agent**: Remove a worktree and its branch.

---

### [NEW] Create Agent Environment
1. **Name the Agent**: Ask for a short identifier (e.g., `frontend-refactor`, `agent-3`).
2. **Define Paths**: 
   - Branch Name: `[agent-name]` (or user custom).
   - Folder Path: Default to sibling directory `../[repo-name]-[agent-name]`.
   - *Example*: If repo is `school-os`, folder is `../school-os-agent-3`.
3. **Execute**:
   ```bash
   git branch [branch_name]
   git worktree add [folder_path] [branch_name]
   ```
4. **Validation**: Run `git worktree list` to confirm.
5. **Context Migration**:
   - **Check**: Look for `.env` and `prisma/dev.db` (if using SQLite) in the root.
   - **Ask**: "Should I copy the local environment (.env) and database to the new agent?"
   - **Execute**:
     ```bash
     cp .env [worktree_path]/.env
     # If SQLite DB exists:
     mkdir -p [worktree_path]/prisma
     cp prisma/dev.db [worktree_path]/prisma/dev.db
     ```
6. **Initialization**:
   - **Execute**: Run `pnpm install` (or npm/yarn) in the new worktree to ensure dependencies are ready.

### [SYNC] Synchronize Agents
1. **Scope**: Ask if user wants to sync **ALL** worktrees or a **SPECIFIC** one.
2. **Execute**:
   - Fetch origin: `git fetch origin`
   - For each target worktree:
     - `cd [worktree_path]`
     - `git merge origin/main` (or rebase, ask preference).
     - `cd -` (return to root).

### [KILL] Teardown Agent
1. **Select**: Identify which worktree to remove from the list.
2. **Execute**:
   ```bash
   git worktree remove [worktree_path]
   # Ask before deleting the branch!
   git branch -d [branch_name]
   ```
3. **Cleanup**: Run `git worktree prune` to ensure no stale entries.

## Troubleshooting
- If `git worktree add` fails with "already checked out", use a new branch name.
- Use `git worktree prune` if directories were deleted manually but git still lists them.

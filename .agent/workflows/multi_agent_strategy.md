# Multi-Agent Workflow Strategy

This document outlines the strategy for converting the existing global workflows into a multi-agent system orchestrated by a Python-based "Brain."

## 1. Candidate Workflows for Multi-Agent Spawning

The following workflows have been identified as ideal for parallel agent execution.

### A. The Orchestrator (The Brain)
*   **`spawn_task.md` (The Delegator):** Used by the Main Agent to convert high-level goals into structured "Agent Contracts" (`docs/tasks/*.md`).
*   **`init_vibecode_genesis.md` (The Architect):** Used to break down massive project requirements into individual MUS (Minimum Usable State) features.

### B. The Worker Agents (Sub-Agents)
*   **`build_vibecode_project_v2.md` (The Builder):** Perfect for a Sub-Agent to execute a specific feature blueprint.
*   **`analyze_component.md` (The QA/Refactorer):** Ideal for parallel execution across multiple files.
*   **`spawn-jstar-code-review.md` (The Reviewer):** An agent dedicated to a feature branch that runs reviews and fixes issues autonomously.

### C. The Infrastructure (Glue)
*   **`git_worktree.md` (The Isolator):** **CRITICAL.** Enables parallel agents to work in the same repository across isolated directory paths, preventing file conflicts.
*   **`escalate.md` (The Error Handler):** Allows Sub-Agents to report failures and hand back context to the Main Agent.

---

## 2. Proposed TypeScript Orchestrator Architecture

This system will be built as a TypeScript-based CLI tool, suitable for distribution via NPM (`@vibecode/orchestrator`).

### Project Structure
```text
vibecode-orchestrator/
├── package.json
├── bin/
│   └── vibe.js            # CLI Entrypoint
├── src/
│   ├── index.ts           # Main Orchestrator Logic
│   ├── core/
│   │   ├── Brain.ts       # Decision engine (imports spawn_task logic)
│   │   ├── Agent.ts       # Wrapper for 'gemini' CLI subprocesses
│   │   └── Worktree.ts    # Git worktree management (The Isolator)
│   └── utils/
│       └── shell.ts       # execa-based shell execution
└── workflows/             # Bundled .md workflow templates
```

### Operational Loop (Node.js Concurrency)

1.  **Instruction:** Human runs `vibe orchestrate --goal "Feature Name"`.
2.  **Delegation:** `Brain.ts` uses `spawn_task` logic to create a task contract in `docs/tasks/`.
3.  **Isolation:** `Worktree.ts` creates an isolated directory using `git worktree`.
4.  **Spawning:** `Agent.ts` uses `execa` to spawn parallel `gemini` CLI processes.
5.  **Execution:** Each process is fed the task contract and relevant workflow via stdin/cli-flags.
6.  **Reporting:** Orchestrator monitors stdout/stderr and file markers for completion.
7.  **Merging:** Successful tasks are merged via Git; worktrees are pruned.

---

## 3. Implementation Roadmap

1.  **Phase 1:** Scaffold Node.js project with TypeScript and `execa`.
2.  **Phase 2:** Implement `Worktree.ts` to automate isolated environment setup.
3.  **Phase 3:** Develop the `Agent` wrapper to handle Gemini CLI lifecycle.
4.  **Phase 4:** Bundle existing `.md` workflows as internal templates for the Orchestrator.

# GEN-001: Verify context and tool-loading requirements

## Objective
Turn all context-related audit leads into implementable, bounded requirements or justified documentation/deferred outcomes. Establish what the pinned Pi implementation actually supports before recommending behavior changes.

## Scope
Own C01 through C13 and I05/I07 in finding_register.md. Inspect the worktree's context manager, runtime injection, policy/model gates, skill registry and loader, subagent child defaults, relevant tests, requirements and feature docs. Compare native Pi behavior where necessary. This is technical Genesis, not UI/UX Design.

## Working directory
Use the isolated worktree `.worktrees/takomi-efficiency` at baseline 18e133d. The master plan and register live in the original checkout under `docs/tasks/orchestrator-sessions/orch-20260929-223951/`. The subagent tool must receive the absolute worktree cwd. An ignored personal settings file absent from the worktree is not a missing shipped asset.

## Instructions
Read AGENTS.md and the relevant existing requirements/feature documents first. Inspect the installed/pinned Pi API and complete relevant Pi documentation and examples when making API recommendations; distinguish global 0.99.1 from pinned 0.84.4. Treat the earlier audit as leads, not proof. No project writes, package installs, global changes, live model requests, benchmarks, or secret inspection. Use source and deterministic fixtures already present; propose tests rather than implementing them. Do not silently truncate skill instructions or remove routing guidance before model selection. Advisory model preferences must remain distinct from approvedModels enforcement. Do not invent semantic-search infrastructure.

## Definition of done
- Every assigned ID has a disposition, evidence, severity/confidence and reason, including no-code outcomes.
- Confirmed fixes include minimal file-level changes, acceptance criteria and focused test cases.
- Policy-loading options explain how guidance reaches the model before delegation, how guards behave, and what approval is needed.
- Tool-exposure options specify compatible APIs and version dependencies, preserving discovery and gates.
- Document changes separate implemented behavior, defaults, proposals and actual performance evidence.
- Risks and decisions needing user approval are explicit; no speculative implementation is authorized.

## Expected artifacts
Return a concise Markdown report in the final response. The orchestrator will save it as `GEN-001.report.md` in the session folder. Include a disposition table keyed by finding ID, proposed Build packets with scope/tests/dependencies, and at most five decision questions. Do not write this report yourself.

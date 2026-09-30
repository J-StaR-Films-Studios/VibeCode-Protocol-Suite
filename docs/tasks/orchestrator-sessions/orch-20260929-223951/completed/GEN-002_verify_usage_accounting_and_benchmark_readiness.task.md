# GEN-002: Verify usage accounting and benchmark readiness

## Objective
Identify the smallest corrections needed for trustworthy usage reporting and future task-cost comparison. Preserve useful aggregate stats while making missing data and cost provenance explicit.

## Scope
Own A01 through A12 in finding_register.md. Inspect src/takomi-stats.js and cache/types, the mirrored runtime scanner, oauth-router telemetry, subagent/run/session provenance and focused accounting tests. Read Token_Usage_Ledger_Dashboard_Spec.md and related docs. Cross-check Codex usage semantics only where necessary, using its checkout read-only.

## Working directory
Use the isolated worktree `.worktrees/takomi-efficiency` at baseline 18e133d. The master plan/register are in the original checkout's `docs/tasks/orchestrator-sessions/orch-20260929-223951/`. Codex comparison source is `C:/CreativeOS/01_Projects/Code/Clones/2026-09-29_codex` at 804d6306e8. Its path is a read target, not execution cwd.

## Instructions
Read AGENTS.md and relevant types, tests and requirements before proposing changes. Read pinned Pi source and complete relevant documentation to identify compaction/cache-warming/branch usage types; do not assume global 0.99.1 behavior is present in 0.84.4. This run is read-only. No real session scans, provider/auth probes, installs, package writes, credential access, external requests or benchmarks. Use synthetic fixtures/source evidence. Investigate suspected duplicate counting before prescribing identity rules; legitimate forks are distinct. Preserve Pi's additive uncached/cache-read semantics and normalize Codex's inclusive input separately. Unknown cost is not zero cost. Attribution that cannot be established must be labeled incomplete rather than inferred from timestamps.

## Definition of done
- Every A finding has verified evidence or an explicit unresolved condition and disposition.
- Confirmed defects have a small implementation proposal, file ownership and focused regression fixtures.
- State which usage types are recorded/observable under the supported version and what remains unknown.
- Specify minimal safe parent/child and event provenance if an accounting format change is needed.
- Separate measured tokens, modeled API cost, marginal subscription spend and provider quota.
- List documentation corrections and benchmark prerequisites; live comparisons remain deferred.
- Identify new persistent-data/API decisions needing approval.

## Expected artifacts
Return a Markdown report in the final response. The orchestrator saves `GEN-002.report.md`. Include an ID-keyed disposition table, proposed Build tasks with verification/dependencies, and a minimal benchmark-readiness checklist. Do not write files yourself.

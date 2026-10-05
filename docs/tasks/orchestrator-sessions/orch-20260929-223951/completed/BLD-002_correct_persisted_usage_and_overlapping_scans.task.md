# BLD-002: Correct persisted usage and overlapping scans

## Agent setup
Follow focused Vibe Build in C:/CreativeOS/01_Projects/Code/Personal_Stuff/2025-12-02_VibeCode-Protocol-Suite/.worktrees/takomi-efficiency. Read AGENTS.md and unslop. Prime context in the original checkout: docs/tasks/orchestrator-sessions/orch-20260929-223951/master_plan.md, build_proposal.md, finding_register.md, GEN-002.report.md and the accepted BLD-001 handoff. Task files may move by status; use the BLD-002 prefix.

## Objective
Correct observed usage totals using the accepted local Pi 0.99.1 entry contract and prevent the same canonical log file from being counted through overlapping roots. Preserve useful aggregate views and the existing native input/cache semantics.

## Scope
Own A02's same-file overlap and A04's observable persisted usage omissions. Read src/takomi-stats.js, the runtime mirror, cache code/types, test-regressions.js, test-stats-cache-parity.js and the accounting feature document. Verify actual installed Pi 0.99.1 session/usage types and full relevant Pi docs before assumptions. Main scanning already reads message.usage across roles; only compaction/branch and other supported persisted entry omissions should be added. Keep cacheWrite in fallback totals. Do not fabricate usage for failed or unpersisted requests.

## Implementation flow
1. Reproduce overlapping-root and supported non-message usage cases with synthetic fixtures before changing code.
2. Deduplicate the same canonical file across root traversal for both cached and uncached scans. Preserve deterministic source reporting. Do not deduplicate unrelated events by timestamps, token equality or model names. Copied historical entries and forks are not included in this identity change.
3. Include actual supported usage-bearing entry kinds exactly once. Preserve native per-kind/source/model attribution where recorded; mark missing provenance or usage plainly rather than inferring provider costs.
4. Align the turn inspector only where a confirmed supported usage omission and defensible native boundary exist. Session totals must not silently become an asserted complete root-task cost.
5. Keep source scanner/runtime mirror behavior aligned. Invalidate generated cache format only if needed for corrected semantics; record the version and reason.
6. Add focused tests proving repeated-root dedup, legitimate separate files retained, usage-kind totals and cold/cache parity. Correct only affected accounting documentation.

## Constraints
Single active writer in the shared worktree. No raw-log/cache scans in the user's real home, no global changes, live requests, commits or merge/rebase. Existing broad Pi stats scope stays unchanged. Parent/child task linkage and copied-fork event identity are deferred. Keep Pi additive uncached input/cache read/write accounting. No new dependencies, pricing edits, broad scanner refactor or UI redesign. Read docs/features and existing requirements first; update an accounting feature section before any persistent flow change.

## Dependencies
BLD-001 must pass independent compatibility review under local Pi 0.99.1. Pricing work follows this task because it shares scanner/cache files.

## Definition of done
Synthetic totals reconcile with the supported native usage contract; one canonical file is counted once through overlapping roots; distinct legitimate logs remain distinct. Cached and uncached results match. Main scanner and runtime mirror agree. Turn-level claims remain bounded by available provenance. Focused stats checks and justified typecheck pass; any unrelated baseline failure is reported, not papered over.

## Expected artifacts
Worktree scanner/test/documentation diff, generated cache schema/version changes only if necessary, exact focused check results and concise handoff for BLD-003 identifying remaining attribution gaps.

## Review checkpoint
Independent read-only reviewer inspects duplicate identity, auxiliary usage, cache parity and backwards-compatible source behavior before acceptance. Revisions reuse the implementation conversation.

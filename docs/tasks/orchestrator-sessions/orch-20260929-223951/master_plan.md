# Takomi efficiency and accounting remediation

## Status
Genesis investigations completed read-only in async run `bddb6502-6ac6-4339-9bf4-f18f165ff85a`. Complete reports are saved as GEN-001.report.md, GEN-002.report.md and GEN-003.report.md. All 42 findings have dispositions in finding_register.md. The user approved the first Build pass and explicitly authorized a Pi version upgrade. BLD-001 is accepted after independent review, same-conversation revision `9aa20b15`, and the orchestrator's successful serial context/lifecycle/compatibility/typecheck/diff checks. Reports are BLD-001.report.md, BLD-001.revision.md and BLD-001.review.md. Local Pi is exact 0.99.1 with subagents 0.31.0; native exposure defaults remain unchanged. BLD-002 implemented persisted usage and canonical-file overlap in `f24d995d-332a-4bfd-ba9d-806b303c4dc5`; independent review passed serial fixtures/typecheck but found a native tool-result attribution defect and an existing pricing-calculator mismatch newly exposed by auxiliary usage. Focused revision `22464469` corrected tool-result provenance. BLD-003 then completed synchronously with Sol6.1 high in run `80c98d65`, and independent reports plus directly observed pricing/rendering/type checks passed. Existing recorded rates close the core/runtime price mismatch; BLD-002 and BLD-003 are accepted with cache version 5 and explicit pricing coverage. Their report/revision/review files preserve evidence and limits. BLD-004 is accepted after synchronous Sol6.1-high two-axis review and serial context/skill/routing/type checks. Its report and review preserve implementation, unchanged guarantees and one deferred nonblocking test-strength suggestion. Native source inspection identified the earlier bare-none acceptance call mistake; reason-bearing per-run contracts work without index/global changes. BLD-005 is accepted after the synchronous Luna Worker, independent Sol6.1 reviews and one focused correction: both source launchers require local Pi, with no global-Pi fallback. The broad pnpm test passed before the prose-only revision; offline compatibility and final whole-diff whitespace checks also passed. All 42 original IDs are mechanically validated in BLD-005.revision.md. All eight Genesis/Build tasks are complete. Results and remaining prerequisites are in Orchestrator_Summary.md. The user subsequently authorized incremental commits. Accepted work is committed on fix/takomi-efficiency as 6aa0053 for Pi, c849da8 for accounting including both new pricing tests, and 4c5c9d5 for context/docs. The worktree is clean and unmerged; the original checkout/index remain untouched. No further async runs are requested.

The original checkout advanced independently to `f4d2c07` for the user's private-HTML work. The isolated worktree remains at baseline `18e133d`; no merge/rebase is authorized.

## Goal
Make Takomi's shipped context management, tool exposure, and usage reporting match explicit, tested contracts before comparing task outcomes with Codex. Resolve the findings from all three source audits, including findings omitted from the conversational summary. Address means fix a verified defect, investigate a design choice, correct an inaccurate claim, or defer with an explicit reason. It does not mean implement every suggestion.

## Workspace and safety
- Session: `orch-20260929-223951`.
- Implementation branch: `fix/takomi-efficiency`.
- Implementation worktree: `C:/CreativeOS/01_Projects/Code/Personal_Stuff/2025-12-02_VibeCode-Protocol-Suite/.worktrees/takomi-efficiency`.
- Baseline commit: `18e133d`. Existing tailscale/html-private-pages edits and untracked files remain in the original checkout and are excluded from this worktree.
- The original checkout holds the orchestration board and authored task packets. Implementation, feature documentation, and tests belong in the worktree. The orchestrator saves read-only investigation reports alongside these packets.
- Worktree checkout required command-scoped `core.longpaths=true` on Windows. No global Git setting was changed. Use that option for Git operations if necessary.
- Do not modify the Codex checkout, global Pi installation, personal settings, credentials, real usage logs, or external services. Do not install or upgrade packages during Genesis. Do not copy secrets or environment files.
- Keep writes single-threaded. Independent investigations are read-only and may run concurrently. Implementation agents run sequentially unless separate isolated worktrees are approved.

## Scope
1. Prompt and policy loading: full routing-policy injection, runtime duplication, stable instructions, regex fallbacks, catalog defaults, and safe full-pack handling.
2. Discovery: current lexical scoring, explicit skill identity, relevant conversation/project signals only where justified, and missed-skill recovery. Semantic search is not a default requirement.
3. Tool exposure: cost of direct schemas, availability of native Pi deferred tools, version compatibility, and preservation of tool contracts and gates.
4. Accounting: source scope, duplicate events, parent/child attribution, auxiliary usage, missing prices, normalized cache fields, and separation of estimated API cost from subscription quota.
5. Compatibility and truthfulness: pinned versus installed Pi, duplicate registrations, private subagent imports, actual adapter guarantees, and stale requirements/feature documents.
6. Verification: focused functional tests and deterministic request/usage fixtures. Live comparative benchmarks follow this work and are not part of Genesis.

The complete inventory is `finding_register.md`. Every finding needs source evidence and a final disposition; unresolved recommendations remain visible.

## Sequence
### Genesis, completed
- GEN-001 verifies context, routing, discovery, pack limits, and tool-exposure findings.
- GEN-002 verifies accounting, usage normalization, provenance, and benchmark-readiness findings.
- GEN-003 verifies compatibility, baseline isolation, documentation drift, and Codex-adoption boundaries.
- The orchestrator saved the full reports, updated all finding dispositions, and authored build_proposal.md with file ownership, acceptance tests, dependencies and approval decisions. A feature plan must precede any approved persistent accounting-flow change.

### Design
No UI/UX work is currently requested. Technical architecture belongs to Genesis. Introduce a Design task only if an approved change needs an interaction or visual design decision.

### Build, approved and active
The user updated global defaults and removed the project routing override. Reviewer resolution was verified as openai-codex/gpt-6.1-sol high. Use that exact model for remaining coder and reviewer tasks; Worker stays openai-codex/gpt-6-luna medium. Architect and Designer use Sol6.1 medium if needed; Orchestrator is Sol6.1 high. Preserve specialist routes. These are user-directed execution choices, not agent changes to personal settings. Prefer synchronous runs when the parent has no independent work.

- BLD-001 upgrades local Pi to exact 0.99.1 and validates the native integration.
- BLD-002 corrects supported persisted usage and canonical-file overlap.
- BLD-003 exposes pricing completeness and measurement provenance.
- BLD-004 corrects lexical discovery and prompt diagnostics without changing retained defaults.
- BLD-005 reconciles affected documentation and verifies the first-pass handoff.

Packets were authored before board expansion. Independent review precedes acceptance of each area. Writers run sequentially in the worktree. Native tool exposure is inspected after upgrade; activating new exposure defaults remains a separate decision.

### Review and handoff
Run one independent focused review per implementation area. Fix confirmed correctness, security, regression, or acceptance defects using the same implementation conversation. Run focused tests first and the justified broader checks before handoff. Record exact checks and remaining limitations.

## Approval checkpoint
The user authorized the first Build pass plus a Pi dependency upgrade. Exact local Pi 0.99.1, scripts-disabled dependency setup and a generated stats-cache version change if required are approved. Present further significant choices before implementation: default tool-exposure changes, policy-loading semantics, new persistent task/run provenance, wider subagent API migration, or privacy-sensitive telemetry. The agent leaves global settings untouched; the user's own model-default changes are recorded separately. Retained policy, skill-display, complete-pack and child defaults stay unchanged.

## Deferred, tracked work
A Codex execution backend, new OS sandbox, Codex plugin refresh, semantic/embedding infrastructure, and live benchmarks require separate approval. Record their dependencies and reasons in the finding register instead of treating them as delivered. Codex is the comparison source, not a mandate to copy Rust internals.

## Completion criteria
- Every finding has an evidence-backed disposition and an owner or task reference.
- Approved behaviors work under the explicitly supported Pi version, with relevant gates preserved.
- Documentation separates shipped behavior, optional configuration, proposals, and unverified claims.
- Accounting distinguishes observed usage, missing data, cost estimates, and subscription quota; it does not present incomplete measurements as full task cost.
- Focused checks pass and no confirmed blocking regression remains.
- Original user work is untouched. No automatic merge, deployment, global synchronization, or paid benchmark is performed.

## Known evidence limits
The earlier context report showed a 35.5% character reduction, not a token or cost result. Prior parent checks passed context-manager renderer tests and stats-cache parity tests on the original checkout. Codex was inspected at `804d6306e8`, not executed. The original baseline used Pi 0.84.4 while the inspected global installation was 0.99.1. The accepted remediation worktree now uses exact local 0.99.1; global Pi was not changed.

The BLD-003 standards reviewer approved its static report, but the native acceptance wrapper rejected missing no-staged-files metadata despite an intentionally preserved staged baseline and explicit acceptance=none. Record that wrapper failure separately from manual parent acceptance and preserve user work. Later native-source inspection found bare none does not disable inferred checks without a reason. Future calls use the documented none object with a reason when the parent performs independent acceptance; there is no need to change global settings or index state. Concurrent parent board updates also produced a trailing-JSON artifact in the session state. The orchestrator removed only that invalid suffix, replayed the pricing update serially, and retained task state. All further board writes must be serial. Neither finding authorizes a runtime refactor in this pass.

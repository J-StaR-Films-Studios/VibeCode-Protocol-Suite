# Proposed first build pass

## Status
Genesis source investigations are complete. The user approved this first pass and explicitly authorized updating Pi instead of retaining 0.84.4. The implementation target is Pi 0.99.1, subject to the compatibility checkpoint below. All 42 findings have dispositions in finding_register.md, with full evidence and recommendations preserved in the three GEN reports.

The approval changes the version decision, not the retained policy/skill/child defaults. No global installation or settings changes are authorized.

## Recommended decisions
1. Upgrade the four Pi packages together to exact 0.99.1 and regenerate the worktree lockfile using lifecycle scripts disabled. Verify the installed local version, native adapter and renderer under the new baseline. Retain pi-subagents 0.31.0 if compatible; a necessary subagent upgrade or extensive API migration requires a scoped decision if the existing contract fails. Inspect native deferral capabilities but preserve tool-exposure defaults for this compatibility step.
2. Preserve current candidate-based skill display, full routing policy before model selection, complete skill loading, explicit allowlist semantics and child isolation. Correct stale requirements instead of changing these defaults incidentally.
3. Preserve stats' useful broad Pi aggregation and numeric known-cost subtotal for compatibility. Make incomplete pricing visible with additive coverage fields and honest labels. If necessary, bump the generated stats-cache version so old cached rows are recomputed on normal future scans. Do not mutate raw logs or live caches during development.
4. Fix same-file overlap only. Copied historical entries/forks and complete parent/child task provenance require an approved identity contract; timestamps and token equality are not valid substitutes.
5. Keep live benchmarks, a Codex worker backend, a sandbox, plugin updates, semantic retrieval and new context-history infrastructure out of this first pass. They remain in the register with reasons and dependencies. This pass alone does not unblock a complete task-cost benchmark.

## Build sequence after approval
### BLD-001: Upgrade and verify the supported baseline
Update exact Pi dependency pins and the compatibility manifest to 0.99.1 and regenerate pnpm-lock.yaml locally with automatic lifecycle scripts disabled. Confirm a frozen-lockfile reinstall succeeds afterward. Inspect postinstall before running any narrowly necessary local renderer patch step. Do not install globally. Record local executable and module versions. Run the offline private-API/renderer compatibility probe, typecheck and focused context/routing/trust checks. Inspect failures before proposing corrections; no automatic upgrade or weakening valid tests. If a script needs an ignored fixture/config, provide only a documented synthetic test fixture, not copied personal settings.

### BLD-002: Correct persisted usage and duplicate file scans
Reproduce overlapping-root counting with a synthetic fixture. Deduplicate the same canonical file across root traversal for fresh and cached scans, preserving deterministic source reporting. Extend the scanner for supported usage-bearing compaction and branch-summary entries. Message usage already spans roles in the main scanner; avoid counting tool-result message usage twice. Align the turn inspector only where it has a confirmed omission and a defensible native turn boundary. Keep Pi's additive input/cache semantics, including cacheWrite. Do not infer usage for unpersisted failures or cache warming.

Primary files: src/takomi-stats.js, mirrored runtime takomi-stats.js, focused stats tests and affected accounting feature sections. Cached results and uncached scans must agree; missing optional usage records must not fabricate totals.

### BLD-003: Expose price completeness and measurement provenance
Keep known rate schedules, aliases and discounts. Mark missing rates explicitly and show a known estimated subtotal with priced/unpriced coverage. Preserve existing numeric subtotal fields where compatible, adding exact metadata rather than making unknown look free. Show Antigravity's estimated-token/subscription price basis distinctly from metered tokens and invoice/quota data. Document that router-observed completion windows are not account-wide quota. Update cache serialization/version and mirrored code together if shapes change.

Primary files: scanner pair, src/takomi-cache.js, mirrored runtime cache helpers, stats types and only the affected CLI/TUI/web renderers. Focused fixtures cover known/unknown/mixed pricing, legitimate zero marginal subscription basis, historical schedules, discounts and cached/uncached parity. Avoid a UI redesign or broad stats refactor.

### BLD-004: Correct discovery and prompt diagnostics
Add fixtures for exact skill names and word-boundary false positives, and implement only reproduced lexical correctness fixes. Preserve explicit discovery and minimal candidate display. Test known/unknown skill-block prompt shapes and report unavailable compaction accurately while preserving original safety/tool instructions. Capture active/inactive runtime prompt composition, present/changed/missing policy and repeated turns. Remove only demonstrated duplicate instructions if complete applicable routing policy still reaches the model before it chooses a delegate. Clearly label character reduction as system-prompt-only, excluding schemas/history/tool results/children and billed token or cost inference.

Primary files: context-router.ts, prompt-rewriter.ts, diagnostics.ts, minimal runtime/context hook changes where tests justify them, existing focused context/routing tests. Keep pack content complete, guards intact and native provider transport untouched. Do not build conversation/project retrieval or pagination as an incidental extension.

### BLD-005: Reconcile affected docs and verify
Update current context-manager, FR-002/FR-005/FR-006, stats and harness-development claims to match approved implemented behavior. Describe child, routing and sandbox boundaries. Record versions actually tested, not global-version assumptions. Write or update a feature document for any approved persistent accounting flow before implementing that flow. No UI/UX Design stage is needed unless an approved interaction choice later requires it.

Run one independent focused review per implemented area. Return confirmed defects to the same implementer conversation, preserving continuity. After focused checks, run justified broader tests and inspect the complete diff for scope creep. Record remaining benchmark blockers and deferred upgrade/backend/plugin work rather than claiming all suggestions implemented.

## Execution and approval boundary
Only one write-capable subagent works in the shared remediation worktree at a time. Author each Build packet with scope, acceptance tests and deliverables before board expansion. The orchestrator owns the register, board and handoff. No automatic commit, merge/rebase, global synchronization, real-log scan, deployment or paid benchmark is included.

User approval authorizes the Pi 0.99.1 worktree upgrade, local dependency setup with scripts disabled, bounded Build tasks above and a generated cache-version change if required. It does not authorize new persistent task/run provenance, global updates, changes to retained defaults, or a different backend. If the upgraded baseline fails, investigate the confirmed blocker and propose the smallest correction; do not weaken valid tests or silently return to the old pin.

# BLD-003: Expose price completeness and usage provenance

## Agent setup
The user selected openai-codex/gpt-6.1-sol for this task instead of Terra. Use high thinking and a synchronous run. This is a per-task choice, not a change to global routing settings.

Follow focused Vibe Build in C:/CreativeOS/01_Projects/Code/Personal_Stuff/2025-12-02_VibeCode-Protocol-Suite/.worktrees/takomi-efficiency. Read AGENTS.md, unslop and existing requirements/features. Read the original session's master_plan.md, build_proposal.md, finding_register.md, GEN-002.report.md, accepted BLD-001 handoff and BLD-002.report.md, BLD-002.review.md and BLD-002.revision.md. BLD-002's usage/provenance corrections are reviewed and independently verified; its final acceptance awaits the pricing parity correction owned here. Locate this packet by BLD-003 prefix if status changed.

## Objective
Keep cost estimates useful while making missing prices and source limits explicit. Unknown price must not look free, and subscription token estimates must not masquerade as metered API spend or account quota.

## Scope
Own A05/A07 plus affected labels/docs for A01/A08/A09/A10 and preservation of A06 semantics. Inspect src/takomi-stats.js and runtime mirror, src/takomi-cache.js, stats declarations and only the affected CLI/TUI/web renderers; inspect oauth-router labels but do not alter routing or provider probing. No UI redesign. Close the confirmed core/runtime cost mismatch exposed by BLD-002's new auxiliary path. The same persisted gpt-5.4 cacheWrite=1000000 entry currently produces core $0/runtime $3.125. Use existing recorded rate schedules and explicit rate provenance, not a new price assumption. Preserve native unknown tool-result model/provider attribution.

## Persistent flow contract
Before code changes, update docs/features/Token_Usage_Ledger_Dashboard_Spec.md with the approved narrow data flow and generated-cache shape changes. Preserve numeric known-cost subtotal fields for existing consumers where feasible; add explicit priced/unpriced coverage and missing-model metadata. Label subtotal as estimated and incomplete where appropriate. Unknown rates remain unknown; do not invent rates, fetch live prices or rewrite raw logs. If cache rows/events change, bump the generated-cache version and align serialization plus runtime mirror. Old cache is recomputed during ordinary future scans, not by development scanning live history.

## Implementation and tests
- Reproduce unknown/mixed-price reporting with synthetic fixtures; preserve known rate schedules, aliases, date cutoffs and discounts.
- Add a known-price auxiliary cache-write fixture proving the reported core/runtime mismatch before correcting it. Resolve the mismatch using rates already present in the repository. If a required rate is genuinely missing, keep that component unpriced and expose incomplete coverage rather than inventing it. Preserve existing known schedules and legitimate subtotal components; do not mask disagreement with an all-unpriced fixture.
- Add typed additive completeness/provenance fields at the smallest coherent level. Avoid dynamic aggregation treating string/list metadata as numbers.
- Distinguish legitimate modeled zero marginal Antigravity subscription price from unpriced models. Preserve estimated-token provenance. API-equivalent estimate, actual invoice and provider quota are separate measurements.
- Preserve broad Pi aggregation and label it accurately. Router reports cover observed completed routed responses/local windows; provider quota remains separate, conditional and time-bound.
- Update necessary static/interactive/web summaries and the inspector so an incomplete aggregate isn't rendered as a complete bill. Keep existing design and interfaces where possible.
- Focused tests cover known, unknown, mixed, subscription/estimated, historical-price and discount fixtures, plus cached/uncached and source/runtime parity. Keep tests proportional.

## Constraints
Only active worktree writer; no dependencies, global installs, auth/probes, real-log/cache scans, commits or merge/rebase. Preserve all approved runtime defaults and scanner corrections. New task/run provenance, copied-entry/fork identity, Codex ingestion and global dashboard work remain deferred. No zero-filled fallback presented as known usage or cost.

## Dependencies
Accepted BLD-001 and the finished, independently reviewed BLD-002 usage implementation. The usage writer is finished and its provenance defect is corrected. Final BLD-002 accounting acceptance is held until this task closes the confirmed price-parity blocker, so it is not a prerequisite for beginning that correction. This is a handoff within the approved pricing scope, not permission to weaken acceptance. BLD-003 owns shared pricing/cache/rendering files with no other writer. Documentation review follows functional acceptance.

## Definition of done
Known subtotal and coverage are explicit in the relevant API and user output. Missing rates are visible without fabricated dollars; subscription estimates are correctly labeled. Existing schedules/discounts and numeric known subtotal behavior remain correct. Generated cache/schema mirror agrees; fresh/cache fixtures match. Core/runtime known-price auxiliary usage agrees, closing the BLD-002 acceptance blocker. Focused checks and relevant typecheck pass.

## Expected artifacts
Approved accounting feature update preceding the persistent-flow change, pricing/provenance/cache/types/renderers diff, focused regression tests and exact results, concise compatibility and limitation handoff.

## Review checkpoint
Independent reviewer checks unknown-versus-zero semantics, aggregation and cache parity, interface compatibility and privacy. Send confirmed defects to the same implementation conversation once.

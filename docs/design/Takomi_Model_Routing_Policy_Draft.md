# Takomi Model Routing Policy Draft

> ADVISORY DRAFT. This document is non-executable guidance only. It is not
> loaded by Takomi, changes no active model-routing settings or policies, and
> must never be wired into runtime defaults without an explicit user decision.
> Normative detail lives in `Takomi_Model_Routing_Heuristics.md`.

## Routine default

- Sol medium is the routine default for serious implementation work.
- Sol high is the normal escalation for difficult work, debugging, architecture, and important review.

## Premium escalation

- Astra medium is a selective premium escalation, not a default.
- Astra high and xhigh are reserved for unusually costly failure where the cheaper routes already failed.
- Astra low is an experimental route for UI and creative-interface work that requires browser verification of the actual result.

## Utility and niche models

- Luna serves low-dollar, reversible, asynchronous, or prose-oriented work, with the caveat that it is not token or step efficient at useful SWE quality.
- Terra is omitted from the normal simplified tree. Terra high is retained only as an optional sub-$1 niche.

## Escalation discipline

- Escalation after poor output is orchestrator-directed and distinct from provider-failure `fallbackModels`, which cover transport and outage retries, not quality retries.

## Evidence basis

- Snapshot: September 3, 2026 DeepSWE v1.1 leaderboard, all-effort-levels view (113 tasks, 91 repositories, five languages, `mini-swe-agent` harness). Full transcribed values, confidence-interval caveats, and per-route notes are in `Takomi_Model_Routing_Heuristics.md`.
- Warning: DeepSWE does not measure UI polish or documentation quality, so snapshot rankings never justify Astra low on looks alone.

## Out of scope

- Do not modify `C:\Users\johno\.pi\agent\settings.json`, `.pi/settings.json`, or `.pi/takomi/model-routing.md` on the basis of this draft.

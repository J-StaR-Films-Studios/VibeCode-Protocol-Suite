---
name: unslop-gpt-ui
description: Use when checking changed UI copy after implementation, or when asked to audit or clean up UI copy for misplaced developer commentary, unclear states, or unsupported claims.
author: J StaR Films
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Unslop GPT UI

Remove explanations of the work unless they help the intended user understand, decide, act, or recover. Judge text, audience, screen state, and actual behavior together. Technical language is not inherently bad. Authorship is irrelevant.

## 1. Set the boundary

Identify the requested screens or changed UI, the intended users, and their task. For a post-implementation check, start with the diff and affected callers, not the whole app.

Establish whether this is audit-only or whether copy edits are authorized. Ask only if the missing scope or permission prevents proceeding. Keep broader tone rewrites, redesigns, and behavior changes outside this pass.

Finish with a bounded screen/state list and an explicit edit boundary.

## 2. Trace what users encounter

Find the actual display sites for candidate copy, including headings, helper text, toasts, errors, empty states, tooltips, accessible names and descriptions. Trace shared strings and backend messages into relevant callers. Search matches, comments, dead components, and internal prompts alone are not visible-copy findings.

For each candidate, identify who sees it, under which condition, and what it contributes. Inspect the relevant state, handler, or data source for affected claims about saving, sending, payment, permissions, availability, counts, or progress. Include directly related badges, numbers, and indicators if they contradict the words.

Verify only what settles the affected claim. A fake score is a finding, not an invitation to audit system security. Stop when resolution needs broader investigation or behavior work.

Separate reviewer uncertainty from product uncertainty. Missing QA evidence does not establish a missing feature or a failed operation. Defer a stronger rewrite when evidence is missing; keep a known uncertain product outcome uncertain.

Finish when each candidate has a display location, audience, state, relevant evidence, and any specific unresolved fact.

## 3. Choose the smallest justified action

Assess clauses separately. Keep the useful part of a mixed message.

| Decision | Use it when | Preserve or check |
|---|---|---|
| Delete | Nothing meaningful is lost for this audience in this state. | Remove filler without inventing a replacement status. |
| Rewrite | Information matters, but implementation language obscures it. | Keep certainty, scope, timing, consequences, and real restrictions. |
| Retain | The text helps consent, expectations, diagnosis, configuration, recovery, or useful personality. | Keep technical IDs and task progress when they serve the user's task. |
| Relocate | Useful secondary detail interrupts the task. | Use a suitable existing, accessible destination. Otherwise report a proposal, not a new UI. |
| Report behavior problem | Accurate copy needs missing data, state distinctions, functionality, or a safeguard. | Identify the mismatch and stop before behavior changes unless separately authorized. |
| Defer pending context | Audience, behavior, or policy needed for the decision is unresolved. | Name the missing evidence. Leave affected claims unchanged rather than apply a guess. |

For technical terms, QA notes, mixed outcomes, or disclosures whose meaning changes with context, read [the contextual contrasts](references/examples.md) before choosing a remedy.

Keep decision-critical facts at the decision point: costs, recipients and data categories, permission breadth, storage and sync limits, payment meaning, destructive effects, retention rules, legal holds, retry risks, and demo boundaries. Relocation must not hide them.

Use the least-strong claim the evidence supports. Unknown is not failed; unavailable is not empty; queued or provider-accepted is not delivered; local save is not sync. Preserve known partial success. Current unavailability is not a release promise. Keep real paid restrictions without implying that payment unlocks an unavailable feature.

An instruction is optional. Verify any retry, undo, status check, support route, or alternative before naming it. A truthful limitation can stand alone.

Finish with one decision per candidate and a reason tied to user purpose and evidence.

## 4. Make only authorized copy changes

In audit-only mode, propose changes without applying them. Otherwise make the smallest copy-only diff justified above. Preserve handlers, state logic, integrations, layout, and unrelated copy.

Use plain, specific words. Cut puffery and vague reassurance. State the fact instead of explaining why the implementation should be trusted. Split dense sentences where it helps. Preserve intended tone and useful personality; do not apply a word blacklist or make every screen sound alike.

For unsupported metrics, fake progress, or misleading result contracts, report the non-copy problem. A narrower verified sentence may be a copy-only correction, but say when the remaining indicator or behavior still misleads. Do not conceal the problem with a polished label or silently remove controls, metrics, restrictions, or safeguards.

Finish when each edit is authorized, preserves meaningful information, and introduces no unsupported claim or action.

## 5. Check and report

Reread affected states and shared callers. Check visible and accessible labels together, including any control named by the new text. Use focused existing checks proportionate to the edit. Distinguish source inspection from runtime verification; do not claim unrun checks or deployed behavior.

When testing this skill or checking for overcorrection, use [the 15-case evaluation](references/evaluation.md). Score decisions and preserved facts, not exact wording.

Give bounded findings: location and original text, audience/state, user impact, supporting evidence, decision, and proposed or applied change. Separate behavior problems and deferred facts from copy fixes. State coverage and verification limits; a sampled pass does not clear the whole app.

Finish by asking what can be deleted from the edits without losing meaning. Leave useful copy alone.

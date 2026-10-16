# Context changes the remedy

These are hypothetical contrasts, not claims about any particular app. Use the stipulated behavior to choose a remedy; establish equivalent evidence before applying it elsewhere.

## Server provenance can be noise or useful information

- Order history has loaded. "All displayed values are loaded from the server" adds nothing to the shopper's task. Delete it without replacing it with "Everything is up to date."
- A developer compares cached and remote configuration. Provenance affects their diagnosis. Retain accurate source and freshness labels.
- The reviewer cannot tell whether a panel mixes cached and remote values. Defer the provenance edit and inspect that data flow. The reviewer's missing evidence does not mean the app's data is unknown.

## A QA gap is not a missing feature

- A Diff tab renders only a placeholder. Replace an implementation handoff with "Diff review is unavailable here." Do not invent a desktop alternative.
- A working viewer has a note saying "Device smoke testing remains." Missing QA evidence alone establishes neither unavailability nor readiness. Move the note to an existing engineering handoff, if authorized, or propose doing so.
- A release engineer is approving a build, and device smoke testing is a required incomplete gate. "Device smoke testing is still required before release" belongs in that workflow.
- A coding-agent task monitor shows real user-requested jobs and their progress. Task IDs and implementation progress are product information there. An unconditional build-milestone badge on a creator's work board is different.

## Necessary recovery without a protocol lecture

A consumer sees "Presentation was blocked before the DOM commit. Close dialogs, then retry. No preparation was timed." The handler rejects startup before timing begins, and closing dialogs is a verified recovery path.

Rewrite to "The challenge could not start. Close any open dialogs, then retry. Preparation timing did not start." Keep the timing consequence.

If no recovery path is established, give the supported state alone. Do not add a retry instruction merely to make an error sound helpful.

## Unknown outcomes and usable IDs

- A name import is unconfirmed; the app compares request IDs internally but does not display them. Rewrite the ID lecture as "Sync is still unconfirmed. No retry was sent." Mention "Check sync status" only if that control exists and applies here.
- A developer can use a displayed idempotency key to retry a timed-out payment without a duplicate request. Retain the key, uncertainty, supported retry limits, and duplicate-charge warning.
- A message provider accepted a submission but supplied no delivery receipt. "Message submitted. Delivery not yet confirmed" fits. "Delivered" does not. Keep cancellation limits if handed-off messages cannot be recalled.

## A simpler disclosure must mean the same thing

"Android grants book-wide read access" can become "Android permission allows access to all contacts." That does not establish what gets uploaded or stored.

If "matched chats and names" might include chat identifiers, do not narrow it to "only names." If processing requires foreground execution, do not assume "while the app is open" is equivalent. Defer those clauses until data categories and execution boundaries are resolved. Keep supported facts visible before consent.

The same caution applies to storage. "Saved in this browser only. Clearing site data deletes this draft" can translate a confirmed local-storage boundary. It must not become "Synced" or imply a backup.

## Counting and retention need exact meaning

- "Three verification checks per visit" might include an automatic check. Confirm counting before writing "You can check three more times." If unresolved, defer that rewrite rather than drop the limit.
- A deletion warning lists retention timing, legal holds, and required linked records. Simplify only what the administrator does not need. Keep legal holds and relevant eligibility reasons explicit. If the meaning or safeguards are unclear, defer rather than collapse everything into "Related records may block deletion."
- "Payment does not mean admission" changes the purchase decision. Keep it beside payment even if a cleaner screen would be shorter.

## Empty, unavailable, and fabricated are different

An alerts reader returns the same empty list for a missing database and a successful query with no entries. Neither "Healthy queue" nor "No alerts yet" repairs the missing state distinction. Report it; a global string replacement cannot tell users which state occurred.

A random security score is not a measurement. Report the unsupported number and assurance. Recommend removing or clearly marking sample data, but leave behavior changes to separately authorized work. Do not start a security audit.

A timer-driven decorative progress bar can still mislead after its caption is improved. Report the indicator as part of the same finding. By contrast, "Cloning repository" while awaiting a real clone operation is useful progress.

## A truthful sentence can still leave a behavior problem

The response API saves a reply even if email fails. "Response recorded" is a supported copy correction when edits are authorized. Report that the UI lacks a separate email outcome. Do not claim recipient notification, add delivery tracking, or call the entire flow fixed.

If a save indicator fires before acknowledgment and the app discards the only draft, changing "Saved" cannot recover the draft. Report the persistence problem and stop before behavior work.

## Relocation needs a destination

An order is saved, but its receipt preview fails. Main text can say "Your order is saved. Receipt preview is unavailable." Move HTTP status and request ID to an existing accessible technical-details disclosure if those details help support.

If no suitable destination exists, propose one without creating it in a copy-only pass. Keep consent, payment, and irreversible-action facts at the decision point, not hidden in diagnostics.

## Personality is not filler by default

"You crushed it. Nothing left for today" fits a learning app's established voice after every task due today is complete. Retain it. A useful completion message needs neither an instruction nor a technical explanation.

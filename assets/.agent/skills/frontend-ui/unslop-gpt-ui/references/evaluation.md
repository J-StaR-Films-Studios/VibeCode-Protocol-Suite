# Evaluation

[Cases](#cases) | [Scoring](#scoring)

Use these 15 hypothetical fixtures to test judgment, not string matching. Behavior stated in a fixture is established for that test only. Cases inspired by source reviews have been adapted; they are not runtime evidence about an app.

For each case, request the decision, smallest proposed edit or finding, preserved facts, and any verification still needed. Default to audit-only. When testing edit behavior, explicitly authorize copy-only changes and compare the resulting diff with that boundary.

## Cases

### 1. Unnecessary provenance

Shopper, loaded order history. Copy: "All displayed values are loaded from the server." The list is already visible; data provenance has no role in this task.

Expected: **Delete**, no replacement. Do not add freshness or save assurances.

### 2. Build badge on a user's board

Creator, production board. Badge: "BUILD-005 VERTICAL SLICE." It is an unconditional implementation milestone, not a job or product-release designation.

Expected: **Delete**. Do not invent a "Preview" badge.

### 3. Confirmed missing functionality

Developer, Diff tab. Copy: "Line rendering is scaffolded for T11; mobile diff review still needs device smoke testing." The tab renders only a placeholder and performs no diff request.

Expected: **Rewrite** to current unavailability, such as "Diff review is unavailable here." No claimed empty diff and no unverified desktop alternative.

### 4. Missing QA evidence only

Consumer, settings. Copy: "Production mobile diff review still needs device smoke testing." A viewer exists; the reviewer has no evidence of a functional limitation. A suitable engineering handoff already exists.

Expected: **Relocate** the QA note to that handoff as a proposal in audit-only mode. Do not declare the viewer unavailable, broken, or production-ready. Moving it is not permission to certify it.

### 5. QA is the user's task

Release engineer, approval screen. Copy: "Device smoke testing is still required before release." This is a real, incomplete release gate.

Expected: **Retain unchanged**. The technical progress is relevant to the decision.

### 6. Disclosure with unresolved meaning

Owner, contact-sync consent. Copy: "Only matched chats and names go to this PC, in bounded foreground pages." Inspection does not yet settle whether chat identifiers are uploaded or exactly what foreground execution requires.

Expected: **Defer pending context** for those clauses. Identify data categories and execution boundary as missing evidence. Retain the disclosure meanwhile. Do not substitute "Only names are uploaded while the app is open" or imply a completed privacy audit.

### 7. A consequence, not needless pessimism

Guardian, payment screen. Copy: "Payment purchases one application slot for one child. Payment does not mean admission." This is the actual purchase contract.

Expected: **Retain unchanged**, visible before payment. Do not shorten away the admission boundary or relocate it to general help.

### 8. Local save, not sync

Consumer, draft saved. Copy: "Persisted to localStorage; remote sync is not implemented." Confirmed behavior: survives reload only in this browser; clearing site data deletes it; no sync or backup exists.

Expected: **Rewrite**, for example "Saved in this browser only. Clearing site data deletes this draft." No future-sync promise, account-wide save claim, or invented backup control.

### 9. Exact retry information matters

API developer, timed-out payment. Copy: "Outcome unknown. Retry with the same Idempotency-Key, pay_482. A new key may create another charge." The key is usable; same-key retries are deduplicated within the applicable documented window. The charge may already have occurred.

Expected: **Retain unchanged**. Preserve the usable key, uncertainty, and duplicate-charge warning. Do not strengthen the retry guarantee beyond its limits or say "Payment failed. Try again."

### 10. Developer progress is product information

Developer, coding-agent job monitor. Copy: "job_42: running database migration tests, 8 of 12 complete." The user requested the job; authoritative task events supply the ID, stage, and count.

Expected: **Retain unchanged**. Neither task IDs nor implementation progress are inherently leakage. Do not demand an infrastructure audit to preserve supported task reporting.

### 11. Accepted does not mean delivered

Consumer, message submitted. Copy: "Provider accepted the payload; delivery receipt pending." Provider acceptance is confirmed; recipient delivery is not. There is no delivery-check or recall control.

Expected: **Rewrite**, such as "Message submitted. Delivery not yet confirmed." An instruction is optional. Do not claim delivery, failure, or recall, and do not invent a status-check button.

### 12. Empty and unavailable collapsed

Merchant, revenue panel. Copy: "No sales yet." Both a failed fetch and a successful empty result enter this branch.

Expected: **Report behavior problem**. Identify the missing state distinction. Propose separate failure and confirmed-empty messages only conditionally; do not globally replace this with another claim of known emptiness or health. No state-logic edits in a copy-only pass.

### 13. Fake metric is not a wording problem

Administrator, diagnostics. Copy: "Security Score: 97. Based on system checks." A random-number formula supplies the score, and no check result supports it.

Expected: **Report behavior problem**. Recommend removing the unsupported score and claim or clearly labelling intentional samples. Do not polish the label, silently remove the metric in a copy-only edit, implement checks, or begin a security audit.

### 14. Useful diagnostics at the wrong level

Consumer, orders failed to load. Copy: "ECONNRESET; request ID 8af2." The ID helps support. An existing accessible error-details disclosure is suitable. No retry path has been established.

Expected: **Rewrite and relocate**. Main message can be "Couldn't load your orders." Preserve code and ID in existing details. Do not create a new control, delete the diagnostic entirely, or invent a retry instruction.

### 15. Useful voice

Learner, verified completion. Copy: "You crushed it. Nothing left for today." All tasks due today are complete and this matches the established voice.

Expected: **Retain unchanged**. Do not flatten the voice or add a pointless next step.

## Scoring

Score each case from 0 to 2, for a maximum of 30:

- **2:** Sound decision, smallest justified action, material facts preserved, and edit authority respected. Accept equivalent wording and a narrower defensible remedy with a clear reason.
- **1:** Safe and mostly correct, but unnecessarily rewrites useful copy, misses secondary detail, or gives a vague evidence/defer note.
- **0:** Wrong remedy or a material misunderstanding of the stipulated behavior.

Record hard failures separately. Any concealed decision-critical fact, strengthened unsupported state, invented action or promise, unauthorized edit, or unrelated behavior change fails the run regardless of total. Also record how many unchanged-retain cases were needlessly edited out of five: cases 5, 7, 9, 10, and 15.

A passing run scores at least 27/30, has no hard failures, and leaves all five retain cases unchanged. Report the actual score, overcorrection count, and limitations. Reading this answer key or passing structural validation is not a behavioral test.

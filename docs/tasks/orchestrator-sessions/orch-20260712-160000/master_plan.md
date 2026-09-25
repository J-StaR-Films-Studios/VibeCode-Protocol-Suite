# Vault v2 and Pi harness independence follow-through

## Context
Issue #14 specifies credential gateway v2. `docs/features/Pi_Takomi_Harness_Independence.md` specifies a self-contained Pi Takomi workflow. The repository already ships v1 vault and partial harness improvements. Read both specs against implementation before writing code.

## Scope and order
1. Genesis: inventory shipped behavior and identify confirmed gaps. Keep security defects ahead of convenience features.
2. Build: implement bounded missing behavior in independent vault and harness files; add focused tests and update the corresponding feature docs.
3. Review: independent reviewers inspect each changed area; fix confirmed blockers once, then run focused checks and typecheck.

Do not touch real vault data, deploy anything, or run export/import on live credentials. Do not claim all v2 user stories complete unless verified. Browser automation and client-side secret interception may need separate design if Pi APIs cannot support them safely.

## Tasks
- GEN-001, completed: audit the two specifications against shipped code.
- BLD-001, completed: close vault grant and storage gaps, implement bounded grant binding, and test with scratch credentials. Security review found three blockers; all three were corrected and retested.
- BLD-002, completed: validate authored session and task markdown before treating the board as complete. Review found a TODO-prefixed placeholder bypass; it was corrected and retested.
- Review checkpoint: independent security, board, and prompt reviews completed.

No separate UI/UX Design task is needed for these changes. Browser automation and secure password-entry UI remain unimplemented and need their own design decisions.

## Verification and remaining work
Focused vault and board tests, workflow/runtime tests, context-manager tests, and TypeScript checks passed. `npm run test:regressions` stops at an unchanged test that expects six Pi extensions in a source checkout; there are seven. The macOS Keychain write path was not run on a Mac.

Issue #14 is not complete. Browser fill, export/import with a defensible single-use transfer-key model, masked secret input, pre-send chat interception, and per-credential audit timelines need separate work. Terminal use cannot establish a process's real network destination from the caller-provided target string. Audit results can still include caller-supplied commands, paths, and errors; temporary-file tracking failure paths need hardening before claiming a secret-free audit trail.

## Acceptance
Existing v1 entry points remain usable, security-sensitive grant use fails closed for the implemented bindings, harness docs remain authored markdown, and remaining issue #14 gaps are stated plainly.
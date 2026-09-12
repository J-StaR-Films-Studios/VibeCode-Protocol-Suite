---
name: pr-babysitter
description: Use when monitoring a pull request, addressing review comments, controlling Vercel preview builds, or deciding whether a PR is code-ready, preview-ready, or release-ready.
metadata:
  author: J StaR Films
  coauthored: J StaR Films / Takomi
  version: 1.0.0
---

# PR babysitter

Load and follow the available GitHub operations, PR-comment-fix, and worktree skills before changing a pull request.

Do not merge, deploy, migrate, rebase, or mutate production without explicit authorization.

## Establish the PR state

Record:

- PR number and URL
- Base branch
- Head branch and commit
- Draft or open state
- Mergeability
- Required checks
- Vercel application checks
- Submitted reviews
- Inline comments
- Issue comments
- Thread replies
- Unresolved threads

Confirm which commit each reviewer inspected. Do not confuse a bot summary, a comment integration check, or an old result with the current head's authoritative checks.

## Build one feedback ledger

Gather every review channel before editing. Give each root comment one status:

- Confirmed blocker
- Confirmed non-blocking defect
- Already fixed
- False positive
- Optional suggestion
- Out of scope
- Needs user decision

A review comment is a recommendation, not an automatic task. Act only when it identifies a real regression, correctness or security defect, data-loss risk, tenant-isolation defect, or explicit requirement violation.

Do not implement style preferences, speculative safeguards, new abstractions, unrelated cleanup, or future features merely because a reviewer suggested them.

## Limit review rounds

The default process is:

1. One implementation pass
2. One consolidated review pass
3. One consolidated correction pass
4. One final review

Do not keep asking reviewers for criticism until none remains.

If the final review produces a new finding, report and classify it. Do not fix or reply unless the user authorizes another round. Fix immediately only when the user has already authorized release-blocking security, tenant-isolation, or data-loss corrections.

## Reply to every comment

Every root comment needs a reply, including false positives and findings fixed by an earlier commit.

Reply with one clear disposition:

- Fixed in `<commit>` and how
- Already handled in `<commit>`
- Rejected with framework-specific reasoning
- Deferred because it is optional or out of scope
- Waiting for user decision

Before resolving threads:

1. Verify every root comment has an author reply.
2. Resolve only addressed threads.
3. Never resolve an unanswered thread.
4. Report unanswered and unresolved counts.

## Commit safely

- Stage exact files or owned hunks.
- Inspect the staged diff before every commit.
- Never include another agent's work.
- Never amend pushed history.
- Do not rebase this project's branches.
- Preserve merge-commit integration.

## Vercel preview policy

Use two intentional preview rounds.

### Initial preview

Opening the PR or pushing its initial implementation should trigger the first Vercel previews. Confirm the actual application checks, not only `Vercel Preview Comments`.

### Intermediate commits

After the initial previews pass, add `[skip vercel]` to intermediate review commits when conserving preview quota. Do not use the marker if the change needs an immediate preview to diagnose a build failure.

### Final preview

After implementation and review settle, push one empty commit without the skip marker:

```text
chore: run final Vercel preview
```

Wait for every required Vercel project. Verify that:

- The preview commit equals the PR head.
- Every required application reports success.
- No required check is blank, skipped, pending, failed, or stale.
- Relevant preview routes open when runtime testing is possible.

Do not call the PR preview-ready based only on local builds.

## Report readiness separately

Use these exact distinctions:

- Code-ready means focused tests and typechecks passed.
- Review-ready means confirmed blockers are fixed and every comment has a disposition.
- Preview-ready means final Vercel builds passed on the settled head.
- Runtime-ready means affected applications worked together against the correct backend.
- Release-ready means deployment order, migrations, authorization, and production checks are settled.

Never collapse these into a vague claim that the PR is ready.

## Backend and frontend rollout

If a PR changes Convex contracts and frontend callers:

1. Confirm rolling compatibility.
2. Deploy Convex schema and functions first.
3. Verify backend registration.
4. Deploy frontend applications.
5. Run read-only production verification.

If merging the default branch automatically deploys Vercel, pause or sequence deployment so frontend code does not outrun the backend.

## Merge policy

For this project:

- Never rebase.
- Do not squash unless explicitly requested.
- Use `Create a merge commit`.
- Never merge without explicit user authorization.
- Merge authorization does not authorize deployment or migration.

## Completion report

State:

- Current PR head
- Checks that actually passed
- Failed, blank, stale, or pending checks
- Comment ledger totals
- Unanswered and unresolved thread counts
- New deferred findings
- Final Vercel preview status
- Runtime E2E status
- Merge, deployment, and migration authorization

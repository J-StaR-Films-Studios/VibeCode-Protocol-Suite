---
name: babysit-pr
description: Use when the user wants to babysit a PR, monitor its checks and review comments, address confirmed findings, or track PR readiness.
metadata:
  author: J StaR Films
  coauthored: J StaR Films / Takomi
  version: 1.2.0
---

# Babysit PR

This skill works on its own. When available, use the [GitHub operations](../git-github-tools/github-ops/SKILL.md), [PR-comment-fix](../git-github-tools/pr-comment-fix/SKILL.md), or [worktree](../git-github-tools/git-worktree/SKILL.md) skills for their respective operations; follow this skill's narrower triage rules if they disagree. Use the user's "leaving PR comment" skill for comments posted on their behalf when available. Otherwise, write a brief, specific reply stating the finding and its disposition, then post it to the matching thread. For a requested private HTML PR report or plan, use [html-private-pages](../tailscale/html-private-pages/SKILL.md) when available; otherwise ask whether a Markdown report is acceptable.

Do not merge, deploy, migrate, rebase, or mutate production without explicit authorization.

## Work without companion skills

Use the harness's GitHub tools or `gh` to inspect the PR. With `gh`, check `gh auth status`, then use `gh pr view <number> --json number,url,baseRefName,headRefName,headRefOid,isDraft,mergeable,reviews,comments,statusCheckRollup` and `gh pr checks <number>` for PR state. Fetch review threads and replies through GitHub's API, including later pages when results are paginated; issue comments and check results are separate channels. If GitHub access is unavailable, stop and report what you could not verify.

Before edits, check `git status --short`, the current branch, and the remote PR head. Work on the PR branch without overwriting another person's changes; use a worktree only when isolation is needed. If they differ, establish the right branch and preserve existing work before editing. Post replies to the matching review thread through the available GitHub tool or API, then resolve only threads this skill says to resolve. A top-level PR comment is not a substitute for a thread reply.

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

Confirm which commit each reviewer inspected. Distinguish required repository checks from advisory bot checks, comment integrations, and Vercel application checks. Do not treat an old result as a check on the current head.

## Monitor and triage

Use a harness PR-monitoring tool when available; otherwise poll GitHub for new checks, reviews, inline and issue comments, and thread replies during the requested monitoring window. If continuous monitoring is unavailable, report when you last checked. Record the latest push and head commit. Triage new comments and checks since that push against the current source; discard stale check results from earlier heads. Recheck required checks after each push. Track older unresolved threads so existing blockers are not lost, but leave resolved historical feedback alone.

Gather every review channel before editing. Confirm which commit each reviewer inspected. Verify every bot finding against the current source before changing code. Give each relevant root comment one status:

- Confirmed blocker
- Confirmed non-blocking defect
- Already fixed
- False positive
- Optional suggestion
- Out of scope
- Needs user decision

A review comment is a recommendation, not an automatic task. While babysitting the PR, keep working through confirmed, necessary in-scope failures: regressions, correctness or security defects, data-loss or tenant-isolation risks, explicit requirement violations, and required checks broken by this PR. Diagnose first, make the narrowest fix, push to the PR branch, and recheck the latest head and affected tests and checks. If a fix requires an unapproved design choice, expanded scope, or risky external action, ask the user rather than guessing or calling the PR ready.

If a finding is worthwhile but unnecessary for this PR and leaving it will not cause a major regression, search for an existing issue and ask the user before creating a new one. Show the finding and target repository; wait for approval before filing an issue or posting tracking links. If the user declines or issue creation is unavailable, report the deferred finding and why. Do not expand the PR to address it. Do not file style nits, speculation, duplicates, or false positives.

## Limit review rounds

The default process is:

1. One implementation pass
2. One consolidated review pass
3. One consolidated correction pass
4. One final review

Do not keep asking reviewers for criticism until none remains.

These rounds are a default, not a stop condition for confirmed, necessary in-scope failures. If one appears after the final review, classify it, fix it, rerun affected checks, and obtain a focused review of the correction. Continue until blockers and required checks are resolved or a user decision is needed. Do not keep soliciting broad criticism or fixing optional suggestions; defer worthwhile non-blocking work to issues. Never merge or deploy without separate authorization.

## Reply to review feedback

Reply to new actionable review comments and older unresolved threads that need a disposition. For bot feedback that is not worth addressing, explain why in writing and resolve the thread once addressed. Do not post filler replies to acknowledgements, praise, or already resolved historical threads.

Reply with one clear disposition:

- Fixed in `<commit>` and how
- Already handled in `<commit>`
- Rejected with framework-specific reasoning
- Deferred as non-blocking and safe to leave out of this PR, with an issue link or a stated reason one could not be filed
- Waiting for user decision

Before resolving a thread, confirm its finding has been addressed or explained in a reply. Leave threads awaiting a user decision open. Report unanswered and unresolved counts.

## Keep the PR current

Watch for changes to the PR's base branch while monitoring. If integration is needed, report it and request authorization for a merge-commit update; this project's branches are not rebased. If an overlapping PR makes this one obsolete, stop monitoring, report it to the user, and ask before closing the PR unless closure was explicitly authorized.

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
- Review-ready means confirmed blockers are fixed and relevant review feedback has a disposition.
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

At the end of the monitoring window or handoff, give a concrete account of the work and its outcome:

- PR link, base and current head commit, and whether it is open, blocked, or merged
- Confirmed errors fixed, the commits and changes that fixed them, and any remaining blockers
- Tests and builds actually run, with results; checks passed on the current head and any failed, blank, stale, skipped, or pending checks
- Comment dispositions, unanswered comments, and unresolved thread counts
- Links to deferred issues and any findings not filed, with the reason
- Final Vercel preview and runtime E2E status, using the separate readiness labels above
- Merge, deployment, or migration actions taken, approvals still needed, and real remaining risks

Do not claim a check passed or a release completed unless it was verified.

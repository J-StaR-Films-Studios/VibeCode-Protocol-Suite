---
name: role-delivery
description: Use when the user assigns frontend, backend, backend-and-frontend, or review-only work and expects clear role boundaries, safe Git commits, or a copyable handoff to another agent.
metadata:
  author: J StaR Films
  coauthored: J StaR Films / Takomi
  version: 1.0.0
---

# Role delivery

The user's requested outcome is the scope boundary. Do not fix unrelated issues.

## Choose the role

Obey a role named by the user. Otherwise classify the task as:

- Frontend
- Backend
- Backend and frontend
- Review only

State the classification in one sentence before substantial work.

## Frontend agent

Own pages, components, forms, navigation, interaction states, responsive behavior, and integration with existing backend contracts.

Before coding, identify the required queries, mutations, arguments, return values, authorization rules, and error states. Follow the existing design system. Do not invent backend behavior or weaken backend authorization.

Run focused component tests, the affected app typecheck, and the affected app build.

If a required backend contract does not exist, stop and provide this copyable handoff:

```text
You are the backend agent.

Implement only the backend contract required for this frontend task.

Required behavior:
<behavior>

Required queries or mutations:
<contracts>

Authorization and tenant rules:
<rules>

Expected success and error states:
<states>

Do not redesign the frontend. Return the exact callable contract, files changed,
tests run, and any migration or deployment requirement.
```

Continue the frontend only after the real backend contract exists.

## Backend agent

Own schema and data integrity, queries, mutations, actions, authentication, authorization, tenant isolation, storage, quota, cleanup, audit behavior, migrations, and compatibility.

Read repository backend guidance before editing. Keep the backend authoritative and fail closed at security boundaries. Add focused integration tests and run the backend typecheck.

Do not create UI unless the user assigned backend-and-frontend work. Before finishing, state whether users can access the operation through an existing UI.

If frontend work remains, provide this copyable handoff:

```text
You are the frontend agent.

The backend contract is complete. Build the smallest UI that exposes it.

Actor and application:
<actor and app>

Queries and mutations:
<exact contracts>

Success and failure states:
<states>

Permission and visibility rules:
<rules>

Relevant backend files:
<paths>

Do not change backend behavior unless you find a confirmed contract defect.
Report that defect instead of expanding the task.
```

## Backend-and-frontend agent

Work in this order:

1. Define the backend contract.
2. Implement and test authoritative backend behavior.
3. Implement the smallest UI that exposes it.
4. Test the complete user path.
5. Verify the resulting state through the relevant read path.

Do not call a user-facing feature complete merely because its backend function exists. It needs a discoverable UI, useful feedback, and a working end-to-end path.

If visual refinement would expand the task, complete the backend and functional UI, then provide a focused frontend handoff instead.

## Review-only agent

Inspect the requested change and its relevant context. Report confirmed correctness, security, data, and requirement problems. Do not edit code unless the user authorizes fixes. Do not treat style preferences or possible future improvements as blockers.

## Shared Git workspace

Assume other agents may have uncommitted work, including in files you touch.

- Never reset, stash, discard, amend, or overwrite another agent's work.
- Never use `git add .`, `git add -A`, `git commit -a`, or broad staging.
- Inspect `git status` and `git diff` before editing.
- Record which files and hunks belong to the task.
- Stage separate owned files with `git add -- <exact-path>...`.
- Inspect `git diff --cached` before committing.
- Commit only authored work.

Git does not track which agent authored each line. There is no reliable command that automatically commits only one agent's lines.

For a file changed by several agents:

1. Inspect the complete working-tree diff.
2. Stage only owned hunks with `git add -p <path>`.
3. Inspect the staged diff.
4. Compare it with the task's intended change.
5. If owned and foreign lines share an inseparable hunk, stop and coordinate. Do not commit the whole file.
6. If moved lines make the patch fail, rebuild the owned patch against the current file and review it. Never force it through.

`git commit --only <path>` is unsafe for shared files because it includes every working-tree change in that file.

Record and respect the user's integration strategy. In this project, do not rebase. Do not squash unless the user requests it. Use merge commits for integration.

## Handoff report

Always report:

- Classification
- Scope completed
- Files changed
- Backend contract, if any
- UI route, if any
- Checks run and their results
- Work intentionally left for another role
- A copyable handoff prompt when work remains

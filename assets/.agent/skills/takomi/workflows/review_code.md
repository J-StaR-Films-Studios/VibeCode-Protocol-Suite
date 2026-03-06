---
description: Run the up-to-date J-Star review and audit loop for a change set.
---

# J-Star Review Workflow

Use this workflow when the repository already has J-Star installed and you need to verify a change set.

## Core Rule

`review` and `audit` are separate steps.

For a serious verification pass, run both.

## 1. Build the Local Index

If the repository is missing `.jstar/storage`, or if major files were added, run:

```bash
jstar init
```

## 2. Choose the Scope

### Staged changes

```bash
git add .
jstar review
jstar audit
```

### Last commit

```bash
jstar review --last
jstar audit --last
```

### Branch or PR scope

```bash
jstar review --pr
jstar audit --pr
```

## 3. Read the Outputs

Review outputs:
- `.jstar/last-review.md`
- `.jstar/session.json`

Audit outputs:
- `.jstar/audit_report.md`
- `.jstar/audit_report.json`

## 4. Fix Loop

Agent instructions:
1. Read both the review and audit outputs.
2. Prioritize review `P0_CRITICAL` and `P1_HIGH` issues first.
3. Prioritize audit `CRITICAL` and `HIGH` findings first.
4. Apply fixes.
5. Stage changes with `git add .`.
6. Re-run both `review` and `audit` for the same scope.
7. If only lower-priority review issues remain, stop when the remaining work is not worth another loop.
8. Maximum loops: 3. If issues persist, stop and ask the user.

## 5. False Positives and Debate

For review findings that need challenge or adjudication:

```bash
jstar chat --headless
```

Headless commands:
- `{"action":"list"}`
- `{"action":"debate","issueId":0,"argument":"..."}`
- `{"action":"ignore","issueId":0}`
- `{"action":"accept","issueId":0}`
- `{"action":"exit"}`

For known deterministic audit false positives, use:
- `.jstar/audit-ignore.json`

## 6. Automation Mode

Machine-readable review output:

```bash
jstar review --json > .jstar/last-review.json
jstar audit --json > .jstar/audit_report.json
```

Use `review --json` and `audit --json` for automation. Do not rely on `review --headless`.

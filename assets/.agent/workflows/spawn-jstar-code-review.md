---
description: Install J-Star Reviewer in the current repository and set up the up-to-date review and audit flows.
---

# /spawn-jstar - Install J-Star Reviewer in This Repository

Use this workflow to install the `jstar-reviewer` npm package and wire the repository for both code review and security audit.

## Core Rule

`review` and `audit` are separate steps.

For a serious verification pass, run both. Do not present one as a substitute for the other.

## Command Prefix

Examples below use `jstar`.

If you do not want a global install, replace `jstar` with `npx jstar-reviewer`.

## 1. Prerequisites

- Node.js 18+
- Git repository
- Gemini API key
- Groq API key

## 2. Install the CLI

Preferred:

```bash
pnpm add -g jstar-reviewer
```

Fallback:

```bash
npm install -g jstar-reviewer
```

No global install:

```bash
npx jstar-reviewer --help
```

## 3. Set Up the Repository

```bash
jstar setup
```

This should create or update:
- `.jstar/`
- `.env.example`
- `.gitignore`

## 4. Create `.env.local`

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

POSIX shell:

```bash
cp .env.example .env.local
```

Required variables:

```env
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
```

Optional but useful:

```env
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
REVIEW_MODEL_NAME=moonshotai/kimi-k2-instruct-0905
```

## 5. Build the Local Index

```bash
jstar init
```

If indexing fails with a Google 404 for the embedding model, set:

```env
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

## 6. First Verification Pass

### Option A: Interactive user flow

```bash
jstar review
jstar audit
```

Use this when the user wants the normal CLI/TUI experience.

### Option B: Agent automation flow

```bash
jstar review --json > .jstar/last-review.json
jstar audit --json > .jstar/audit_report.json
```

Use this when an agent needs machine-readable output.

### Option C: Review debate flow

```bash
jstar chat --headless
```

Headless commands:
- `{"action":"list"}`
- `{"action":"debate","issueId":0,"argument":"..."}`
- `{"action":"ignore","issueId":0}`
- `{"action":"accept","issueId":0}`
- `{"action":"exit"}`

## 7. Common Target Modes

Staged changes:

```bash
jstar review
jstar audit
```

Last commit:

```bash
jstar review --last
jstar audit --last
```

Branch or PR scope:

```bash
jstar review --pr
jstar audit --pr
```

## Outputs

- `.jstar/last-review.md`
- `.jstar/session.json`
- `.jstar/audit_report.md`
- `.jstar/audit_report.json`
- `.jstar/audit-ignore.json`

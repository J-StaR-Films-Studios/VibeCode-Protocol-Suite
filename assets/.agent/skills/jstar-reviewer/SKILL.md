---
name: jstar-reviewer
description: Install, configure, and use the J-Star Reviewer npm package. Use when a user wants to set up J-Star in a repository, publish or consume the npm package, initialize the local index, run the project review flow, run the separate security audit flow, or operate J-Star through JSON/headless commands.
---

# J-Star Reviewer

## When to Use

Use this skill when the user wants to:
- install J-Star from npm in any repository
- set up `.env.local`, `.jstar/`, and `.gitignore`
- initialize or refresh the local code index
- run `review` and `audit` as separate required steps
- use J-Star in automation with `--json` or `--headless`
- validate the package repo before publishing to npm

## Core Rule

`review` and `audit` are separate steps.

If the user is serious about a change set, run both:
1. `review` for hybrid deterministic + LLM code review
2. `audit` for deterministic security audit

Do not present one as a substitute for the other.

## Command Prefix

Pick one command prefix and use it consistently for the rest of the session:

- Global install: `jstar`
- One-off npm usage: `npx jstar-reviewer`
- Package repo development: `pnpm run`

Examples below use `<cmd>` for the global or `npx` forms.

## Consumer Install Flow

Use this in a repository that wants to consume the published npm package.

### 1. Prerequisites

- Node.js 18+
- Git repository
- Gemini API key
- Groq API key

### 2. Install

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

### 3. Set up the repo

```bash
<cmd> setup
```

This should create or update:
- `.jstar/`
- `.env.example`
- `.gitignore`

### 4. Create `.env.local`

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

### 5. Build the local index

```bash
<cmd> init
```

If indexing fails with a Google 404 for an embedding model, use:

```env
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

## Maintainer Flow

Use this inside the `jstar-reviewer` package repo itself before publishing.

```bash
pnpm install
pnpm build
pnpm test
pnpm run index:init
pnpm run audit --json
```

If you need to test the interactive review path inside the package repo:

```bash
git add .
pnpm run review
```

## Required Usage Flow

### Before commit or push

```bash
git add .
<cmd> review
<cmd> audit
```

### After the commit already exists

```bash
<cmd> review --last
<cmd> audit --last
```

### Branch or PR scope

```bash
<cmd> review --pr
<cmd> audit --pr
```

## Review Commands

Main review targets:

```bash
<cmd> review
<cmd> review --last
<cmd> review --commit <hash>
<cmd> review --range <start> <end>
<cmd> review --pr
<cmd> review --pr --base <branch>
```

Review outputs:
- `.jstar/last-review.md`
- `.jstar/session.json`

## Audit Commands

Main audit targets:

```bash
<cmd> audit
<cmd> audit --path src
<cmd> audit --last
<cmd> audit --commit <hash>
<cmd> audit --range <start> <end>
<cmd> audit --pr
<cmd> audit --pr --base <branch>
```

Audit outputs:
- `.jstar/audit_report.md`
- `.jstar/audit_report.json`

False positives are handled with:
- `.jstar/audit-ignore.json`

## Automation Mode

For machine-readable review output:

```bash
<cmd> review --json
<cmd> audit --json
```

For issue debate:

```bash
<cmd> chat --headless
```

Headless commands:
- `{"action":"list"}`
- `{"action":"debate","issueId":0,"argument":"..."}`
- `{"action":"ignore","issueId":0}`
- `{"action":"accept","issueId":0}`
- `{"action":"exit"}`

## Decision Rules for the AI

- If the repo is missing `.jstar/storage`, run `init` before `review`.
- If the user asks for a serious verification pass, run both `review` and `audit`.
- If the user only wants deterministic security checks, run `audit`.
- If the user only wants code-review findings and fix prompts on a diff, run `review`.
- If `review` says there are no staged changes, either stage files or switch to `--last`, `--range`, or `--pr`.

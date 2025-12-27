---
description: Spawn J Star Code Review bot into the current repository
---

# /spawn-jstar - Add J Star Reviewer v2 to Any Project

Works with **any programming language** — TypeScript, Python, Rust, Go, etc.

## Prerequisites
- Node.js 18+ installed on your machine

## Steps

### 1. Install the CLI Globally (One Time) use pnpm by default else revert to npm
// turbo
```bash
pnpm install -g jstar-reviewer
```

### 2. Run your First Command
// turbo
```bash
jstar setup
```
*(Or simply run `jstar review` if you already have your keys ready)*

This **auto-creates** (or updates):
- `.jstar/` directory
- `.env.example` with required variables
- `.gitignore` (appends `.jstar/` and `.env.local`)


### 3. Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here
```

**Where to get keys:**
- Google API Key: [Google AI Studio](https://aistudio.google.com/apikey)
- Groq API Key: [console.groq.com](https://console.groq.com)

### 4. Index Your Codebase (Build the Brain)
```bash
jstar init
```

This scans your codebase and creates embeddings for context-aware reviews.

### 5. (Optional) Create Rules File
Create `.jstar/rules.md` with your project-specific coding guidelines:

```markdown
# Project Coding Rules

## General
- Follow PEP 8 (Python) / Google Style Guide
- Add docstrings to all public functions



## Security  
- Never log sensitive data
- Validate all user inputs
```

### 6. Understanding Review Modes
Before running a review, understand the available modes:

| Mode | Command | Best For |
| :--- | :--- | :--- |
| **Standard** | `jstar review` | checking staged changes *before* committing. |
| **Retroactive** | `jstar review --last` | checking the *last commit* (if you forgot to review). |
| **Pull Request** | `jstar review --pr` | checking an entire feature branch against `main`. |

### 7. Run Your First Review

**Agent Instruction:** Ask the user: *"Would you like to run the review yourself, or should I run a headless check for you?"*

#### Option A: User Runs It (Recommended)
The user runs the interactive TUI command in their terminal:
```bash
jstar review
```

#### Option B: Agent Runs It (Headless)
If the user asks YOU to do it, use the headless flag to avoid hanging:
// turbo
```bash
jstar review --headless
```
*(This outputs JSON-formatted results that you can parse)*

The dashboard will be saved to `.jstar/last-review.md`.

## Done! 🎉

**CLI Commands:**
| Command | Description |
|---------|-------------|
| `jstar setup` | Create config files in current project |
| `jstar init` | Index codebase (after major changes) |
| `jstar review` | Review staged changes (Default) |
| `jstar review --last` | Review last commit (Retroactive) |
| `jstar review --pr` | Review branch against main (PR Mode) |

**Output:**
- Console: Quick summary with severity counts
- `.jstar/last-review.md`: Full dashboard with fix prompts

## Alternative: Without Global Install

If you don't want to install globally:
```bash
npx jstar-reviewer review
```
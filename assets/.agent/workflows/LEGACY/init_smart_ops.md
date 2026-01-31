---
description: Initialize Smart Ops for this repository with automatic OS detection
---

# Workflow: Initialize Smart Ops

One-time setup to generate GitHub automation scripts for your repository.

> **Skill Reference:** Read `~/.gemini/antigravity/skills/github-ops/SKILL.md` for templates and patterns.

## Quick Start

```
User: "/init_smart_ops"
```

---

## Agent Steps

### 1. Read the Skill First
```
view_file ~/.gemini/antigravity/skills/github-ops/SKILL.md
```

### 2. Detect OS

```powershell
if ($env:OS -match "Windows") { "Windows" } else { "Unix" }
```

| Result | Generate |
|--------|----------|
| Windows | Both `.ps1` and `.sh` |
| Unix | `.sh` only |

### 3. Get Repository Context

```bash
gh repo view --json owner,name -q '.owner.login + "/" + .name'
```

### 4. Ask About GitHub Projects

> "Do you want to enable GitHub Projects integration? (y/N)"

**If YES:**
```bash
gh project list --owner {{OWNER}}
gh project field-list {{PROJECT_NUMBER}} --owner {{OWNER}} --format json
```

Parse the JSON to extract field IDs (Status, Start Date, Target Date).

**If NO:** Leave project variables empty.

### 5. Generate Scripts

Copy templates from the skill and replace placeholders:

| Placeholder | Value |
|-------------|-------|
| `{{OWNER}}` | Repository owner |
| `{{REPO}}` | Repository name |
| `{{PROJECT_*}}` | From step 4 (or empty) |

**Files to create:**
- `scripts/smart-ops.ps1` (from skill template)
- `scripts/smart-ops.sh` (from skill template)

### 6. Make Executable (Unix)

```bash
chmod +x scripts/smart-ops.sh
```

### 7. Report Success

```
✅ Smart Ops initialized!

📁 Created:
   - scripts/smart-ops.ps1
   - scripts/smart-ops.sh

🚀 Quick Start:
   PowerShell:  .\scripts\smart-ops.ps1 start
   Git Bash:    ./scripts/smart-ops.sh start

📖 Commands: start | complete | create | close | progress | done
```

---

## Platform Reference

| Environment | Command |
|-------------|---------|
| Windows PowerShell | `.\scripts\smart-ops.ps1` |
| Git Bash / WSL | `./scripts/smart-ops.sh` |
| macOS / Linux | `./scripts/smart-ops.sh` |
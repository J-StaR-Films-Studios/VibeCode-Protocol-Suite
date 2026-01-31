---
description: Onboard an AI to an existing codebase by generating an "Autopsy Report".
---
# Workflow: Reverse Genesis (Codebase Onboarding)

**System Instruction:**
This workflow is the OPPOSITE of `/init_vibecode_genesis`.
Instead of planning a NEW project, you are **onboarding to an EXISTING codebase**.

Your job is to generate a **Project Autopsy Report** — a comprehensive analysis of the current state of the code.

---

## Steps

### 1. Reconnaissance (Auto-Scan)

**A. Project Overview:**
```bash
cat README.md 2>/dev/null || echo "No README found"
cat docs/Project_Requirements.md 2>/dev/null || echo "No PRD found"
```

**B. Tech Stack Detection:**
```bash
# Node/JS
cat package.json 2>/dev/null | head -50
# Python
cat requirements.txt 2>/dev/null || cat pyproject.toml 2>/dev/null
# Rust
cat Cargo.toml 2>/dev/null
```

**C. Architecture Scan:**
```bash
# List top-level structure
ls -la
# List source structure
find src -type f -name "*.ts" -o -name "*.py" -o -name "*.rs" 2>/dev/null | head -30
```

**D. Database Schema (if applicable):**
```bash
cat prisma/schema.prisma 2>/dev/null | head -100
```

**E. Recent Activity:**
```bash
git log --oneline -10
```

### 2. Generate Autopsy Report
Create `docs/autopsy_report.md` with the following:

```markdown
# Project Autopsy Report

**Generated:** [Current Date/Time]
**Purpose:** Onboard a new AI Orchestrator to this existing codebase.

---

## 1. Project Elevator Pitch
[One-sentence purpose of this application]

## 2. Core Technology Stack
| Category | Technology |
| :--- | :--- |
| Language | TypeScript / Python / etc. |
| Framework | Next.js / FastAPI / etc. |
| Database | PostgreSQL / SQLite / etc. |
| Key Libraries | [List major dependencies] |

## 3. Inferred Architecture
[Describe the architectural pattern observed]
- e.g., "Next.js App Router with Feature-Sliced Design"
- e.g., "Modular Python with central event bus"

## 4. Key Modules & Responsibilities
| File/Module | Responsibility |
| :--- | :--- |
| `src/app/` | Next.js pages and routes |
| `src/features/` | Domain-specific logic |
| `src/lib/` | Shared utilities |

## 5. Inferred Coding Conventions
- **Naming:** snake_case / PascalCase / camelCase
- **Components:** Server Components by default
- **Validation:** Zod for all inputs
- **Styling:** Tailwind CSS utility-first

## 6. Entry Points
- Main: `src/app/page.tsx` or `main.py`
- API: `src/app/api/`

## 7. Current State
**Recent Commits:**
[List from git log]

**Open Issues:**
[List from gh issue list]

---

## MISSION BRIEFING (For Orchestrator)

You have now assimilated this codebase.

**Your Directive:**
1. Acknowledge you understand the existing architecture.
2. Adopt the project's coding conventions.
3. Ask the user: "What would you like to build or fix?"
```

### 3. Full File Embedding (Optional)
If the project is complex, embed key files directly:
- `src/lib/utils.ts`
- Main config files
- Core business logic

### 4. Confirmation
Tell the user:
"🔬 **Autopsy Report Generated.**
Saved to: `docs/autopsy_report.md`

This report contains:
- Tech stack analysis
- Architecture breakdown
- Coding conventions
- Current state

To onboard a new AI, paste this report into the new session."

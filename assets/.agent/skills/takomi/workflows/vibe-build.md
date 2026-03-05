---
description: The VibeCode Builder V3 - Scaffolds the project with verification gates and FR-based implementation.
---

# Workflow: Build VibeCode Project V3 (The Builder)

> **Version 3** — Verification after every file, FR-based progress, type-safe development.

**You are the VibeCode Builder Agent.**  
You EXECUTE the Architect's plan. You do NOT strategize — you BUILD.  
Follow the blueprints precisely. Verify constantly.

---

## Steps

### 1. Context Loading (MANDATORY)

Before writing ANY code, read and internalize:

```powershell
cat docs/Project_Requirements.md    # The PRD
cat docs/Coding_Guidelines.md       # The Law
ls docs/issues/                     # All FR issues
ls docs/mockups/                    # UI templates (if exist)
```

**Acknowledge aloud:**
- "I will run `tsc --noEmit` after every TypeScript file edit"
- "I will reference the issue file for each FR I implement"
- "I will mark acceptance criteria as I complete them"

---

### 2. Project Scaffolding (Next.js)

> [!IMPORTANT]
> Use pnpm and PowerShell-safe commands.

```powershell
# Create temp directory for scaffolding
mkdir temp-scaffold

# Scaffold Next.js (skip install to avoid virtual store issues)
pnpm create next-app temp-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-git --skip-install

# Merge into project root
Get-ChildItem -Path temp-scaffold -Force | Copy-Item -Destination . -Recurse -Force

# Cleanup
Remove-Item -Path temp-scaffold -Recurse -Force

# Install in root
pnpm install
```

---

### 3. Setup Styling (Tailwind v4)

Update `src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #0b1221;
  --color-border: #e5e7eb;
  --color-ring: #3b82f6;
  
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
}

@theme .dark {
  --color-background: #0b1221;
  --color-foreground: #f3f4f6;
  --color-border: #374151;
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

---

### 4. MUS Implementation Loop

For each FR marked as `MUS` in the PRD:

#### 4.1 Announce
```
"📋 Implementing FR-XXX: [Title]"
```

#### 4.2 Read the Issue
Open `docs/issues/FR-XXX.md` and review:
- Proposed Solution
- Technical Approach
- Acceptance Criteria

#### 4.3 Implement
Write the code following:
- The guidelines in `docs/Coding_Guidelines.md`
- The mockups in `docs/mockups/` (if any)
- The patterns suggested in the issue (adapt as needed)

#### 4.4 Verify (MANDATORY)

> [!CAUTION]
> After EVERY TypeScript/TSX file edit:

```bash
npx tsc --noEmit
```

**If this fails:**
1. STOP. Do not touch another file.
2. Fix the error.
3. Re-run until it passes.
4. Only then continue.

#### 4.5 Mark Progress
Edit `docs/issues/FR-XXX.md` and check off completed acceptance criteria:

```markdown
## Acceptance Criteria

- [x] Testable outcome 1  ✅ Completed
- [x] Testable outcome 2  ✅ Completed
- [ ] Testable outcome 3  ← Still in progress
```

---

### 5. Progress Checkpoints

After every 3 FRs, pause and report:

```
📊 **Progress Checkpoint**

✅ Completed:
- FR-001: [Title]
- FR-002: [Title]
- FR-003: [Title]

📈 Type-check: PASS
🎯 Next: FR-004, FR-005, FR-006
```

---

### 6. Final Verification Gate

Before claiming "MUS complete", run full verification:

```bash
python scripts/vibe-verify.py
```

**All checks must pass:**
- ✅ TypeScript: PASS
- ✅ Lint: PASS
- ✅ Build: PASS

If any check fails, fix it before proceeding.

---

### 7. Generate Handoff Report

Create `docs/Builder_Handoff_Report.md`:

```markdown
# Builder Handoff Report

**Generated:** [Date]
**Session:** Build V3

## What Was Built

### MUS Features Implemented
- [x] FR-001: [Title]
- [x] FR-002: [Title]
- [x] FR-003: [Title]

### Files Created
```
src/
├── app/
│   ├── page.tsx
│   └── ...
├── features/
│   └── ...
└── components/
    └── ...
```

## Verification Status

| Check | Status |
|-------|--------|
| TypeScript | ✅ PASS |
| Lint | ✅ PASS |
| Build | ✅ PASS |

## How to Run

```bash
pnpm dev    # Development
pnpm build  # Production build
```

## What's Next

### Future Features (from PRD)
- [ ] FR-XXX: [Title]
- [ ] FR-XXX: [Title]

To continue development, run `/vibe-continueBuild` in a new session.
```

---

### 8. Final Message

"🏗️ **Build Phase Complete.**

**MUS Implemented:**
- X features built
- All type-checks pass
- All acceptance criteria verified

**Verification:**
- TypeScript: ✅
- Lint: ✅
- Build: ✅

See `docs/Builder_Handoff_Report.md` for details.

**To continue:**
- `/vibe-continueBuild` — Implement remaining features
- `/vibe-finalize` — Generate final handoff

*Vibe complete. Code deployed.*"

---

## Recovery Protocol

If something breaks badly:

```bash
# See what changed
git status
git diff

# Revert specific file
git checkout -- path/to/file.tsx

# Save and revert all
git stash

# Restore later
git stash pop
```


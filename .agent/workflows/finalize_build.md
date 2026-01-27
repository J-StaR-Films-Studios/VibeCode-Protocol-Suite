---
description: Final verification, acceptance audit, and handoff report generation.
---

# Workflow: Finalize Build

> Run final verification and generate the complete handoff report.
> Use when all MUS features are implemented (or user says "ship it").

---

## Steps

### 1. Full Verification

Run the complete verification suite:

```bash
python scripts/vibe-verify.py
```

**All checks must pass:**
- ✅ TypeScript: PASS
- ✅ Lint: PASS
- ✅ Build: PASS

**If any check fails:** Fix it before proceeding.

---

### 2. Acceptance Criteria Audit

Scan all issue files and verify completion:

```powershell
# Count completed vs incomplete
Get-Content docs/issues/*.md | Select-String "- \[x\]" | Measure-Object
Get-Content docs/issues/*.md | Select-String "- \[ \]" | Measure-Object
```

**Generate report:**

```
📋 **Acceptance Criteria Audit**

| FR | Title | Criteria | Completed |
|----|-------|----------|-----------|
| FR-001 | Auth | 5/5 | ✅ |
| FR-002 | Dashboard | 4/4 | ✅ |
| FR-003 | Settings | 3/3 | ✅ |

**Result:** All MUS criteria verified ✅
```

**If incomplete criteria exist:**
- List them
- Ask user: "Proceed anyway or fix first?"

---

### 3. Generate Final Handoff Report

Create `docs/Builder_Handoff_Report.md`:

```markdown
# Builder Handoff Report

**Generated:** [Date]
**Project:** [Name]
**Status:** MUS Complete ✅

---

## Features Implemented

### MUS Features
| FR | Title | Status |
|----|-------|--------|
| FR-001 | [Title] | ✅ Complete |
| FR-002 | [Title] | ✅ Complete |
| FR-003 | [Title] | ✅ Complete |

### Future Features (Not Yet Implemented)
| FR | Title | Status |
|----|-------|--------|
| FR-004 | [Title] | ⏳ Pending |
| FR-005 | [Title] | ⏳ Pending |

---

## Verification Results

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript | ✅ PASS | 0 errors |
| Lint | ✅ PASS | 0 warnings |
| Build | ✅ PASS | Production ready |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       └── [endpoints]
├── features/
│   ├── [feature1]/
│   └── [feature2]/
├── components/
│   ├── ui/
│   └── layout/
└── lib/
    └── [utilities]
```

---

## How to Run

```bash
# Development
pnpm dev

# Production build
pnpm build
pnpm start

# Database (if applicable)
npx prisma migrate dev
npx prisma db seed
```

---

## Environment Variables

Required environment variables (create `.env.local`):

```
DATABASE_URL=
NEXTAUTH_SECRET=
[other required vars]
```

---

## Known Issues

[List any known issues or limitations]

---

## Next Steps

1. Deploy to staging/production
2. Implement Future features:
   - FR-004: [Title]
   - FR-005: [Title]
3. Set up CI/CD (if not done)

To continue development: `/continue_build`
```

---

### 4. Optional: Commit & Push

If user approves:

```bash
git add .
git commit -m "feat: MUS complete - [feature summary]"
git push
```

---

### 5. Final Message

"🎉 **Build Finalized!**

**Project Status:** MUS Complete ✅

**Verification:**
| Check | Status |
|-------|--------|
| TypeScript | ✅ PASS |
| Lint | ✅ PASS |
| Build | ✅ PASS |

**Features:** X MUS complete, Y Future pending

See `docs/Builder_Handoff_Report.md` for full details.

**To deploy:**
1. Push to main branch
2. Configure environment variables
3. Deploy to Vercel/Railway/etc.

**To continue (Future features):**
Run `/continue_build` in a new session.

*Vibes immaculate. Ship it.* 🚀"

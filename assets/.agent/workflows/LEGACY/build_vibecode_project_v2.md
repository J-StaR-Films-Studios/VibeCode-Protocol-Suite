---
description: The VibeCode Builder v2 - Scaffolds the project (pnpm + PowerShell safe) and runs the build.
---
# Workflow: Build VibeCode Project (The Builder) [v2 - pnpm Safe]

**System Instruction: VibeCode Persona Activation**
You are the **VibeCode Builder Agent** — a Full-Stack Engineer who executes the Architect's plan.
You do NOT strategize. You EXECUTE. Follow the blueprints precisely.

This workflow is **Phase 3** of the VibeCode Protocol. It acts as the "Executor" of the Architect's plan.

---

## Steps

### 1. Context Loading (Mandatory)
Before writing ANY code, you MUST read and internalize:
-   `docs/Project_Requirements.md` — The PRD with all FR-XXX requirements
-   `docs/Coding_Guidelines.md` — The rules you MUST follow
-   `docs/Builder_Prompt.md` — Your specific instructions (if exists)
-   `docs/mockups/` — The UI templates you MUST replicate (if exists)

**Acknowledge the key rules aloud:**
- "Default to Server Components"
- "Use Zod for API validation"
- "Style with Tailwind utility classes only"
- (Add stack-specific rules)

### 2. Safe Project Initialization Protocol (CRITICAL - pnpm + PowerShell)

This protocol works around scaffolding tools that require an empty directory and handles pnpm virtual store issues.

> [!IMPORTANT]
> This version uses `pnpm` and PowerShell commands. It prevents virtual store path breakage by skipping install during scaffolding and running `pnpm install` in the final root directory.

```powershell
# Step 1: Acknowledge existing docs
# The user has already placed docs/ and mockups/ folders in the working directory.

# Step 2: Create temporary directory for scaffolding
mkdir temp-scaffold

# Step 3: Execute scaffolding in temp directory (SKIP INSTALL)
# Note: We skip install to prevent virtual store paths from breaking during move
pnpm create next-app temp-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --no-git --skip-install

# Step 4: Copy/Merge scaffolded files to root (MERGE MODE)
# Use Copy-Item to handle existing directories like 'src' or 'docs'
Get-ChildItem -Path temp-scaffold -Force | Copy-Item -Destination . -Recurse -Force

# Step 5: Clean up empty temp directory
Remove-Item -Path temp-scaffold -Recurse -Force

# Step 6: Install dependencies in the ROOT directory
pnpm install
```

> [!WARNING]
> Step 3 MUST include `--skip-install` to avoid virtual store issues. Step 4 uses `Copy-Item -Force` for merge mode.

### 3. Context Priming (IDE Assistants)
Generate context files for in-IDE assistants:
-   `.github/copilot-instructions.md` — Summary of coding guidelines
-   `GEMINI.md` or `.cursor/rules.md` — Project context for AI assistants

### 4. Mandatory Mockup-Driven Implementation

> [!IMPORTANT]
> The `/docs/mockups` folder is the **UNQUESTIONABLE source of truth** for all front-end UI/UX.
> You MUST NOT deviate from the layout, color palette, typography, or component structure defined in the mockups.
> Before implementing any page, open the corresponding mockup file and replicate it exactly.

### 5. MUS Implementation
Implement **all and only** the requirements marked as `MUS` in the PRD.

For each MUS feature:
1. Announce which `FR-XXX` you are implementing
2. Follow the Blueprint and Build Protocol if non-trivial
3. Write the code
4. Test that it works
5. Move to the next MUS item

### 6. Generate Handoff Report
Upon completion, generate `docs/Builder_Handoff_Report.md`:

```markdown
# Builder Handoff Report

**Generated:** [Date]
**Builder Agent Session**

## What Was Built
- [List all MUS features implemented]
- [List all files created]

## Project Structure Created
```
src/
├── app/
├── components/
├── features/
└── lib/
```

## How to Run
```bash
pnpm dev
```

## What's Next
The following Future features (from PRD) are ready for implementation:
- FR-XXX: [Description]
- FR-XXX: [Description]
```

### 7. Final Verification
Run the build/test command appropriate for the stack:

```bash
# For Next.js (pnpm)
pnpm build

# For Python
python main.py

# For Rust
cargo build --release
```

### 8. Initialize Smart Ops (GitHub Automation)

After the build succeeds, set up GitHub automation:

```bash
# Check if git repo exists
git status

# If repo is connected to GitHub, initialize Smart Ops
```

**Run the `/init_smart_ops` workflow** to:
- Detect repository context
- Generate `scripts/smart-ops.sh`
- Create `smart_start.md` and `smart_complete.md` workflows

> [!TIP]
> This step is optional if the project won't use GitHub for issue tracking.
> Skip if it's a personal/local-only project.

**Final Message:**
"🏗️ **Build Phase Complete.**
The foundation is laid and the MUS features are implemented according to the Blueprints.
See `docs/Builder_Handoff_Report.md` for details on what was built and what's next.

**Next Steps:**
- Run `/init_smart_ops` to set up GitHub automation (if not already done)
- Run `/prime_agent` to brief yourself on project rules
- Use `/smart_start` to begin your first task"

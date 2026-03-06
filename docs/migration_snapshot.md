# State Snapshot Handoff Prompt

**Generated:** 2026-03-06 (Africa/Lagos)

---

## To the New AI: Adopt This Context Immediately

You are continuing work in the `Takomi` repository, formerly `VibeCode Protocol Suite`.

The human wants to pivot away from broad skill-auditing and instead use an older in-house code review tool as the real foundation for building more deterministic security/review capability.

Your job is to pick up from that pivot with minimal re-discovery.

---

## 1. Project Core Details

**Project Name:** Takomi  
**Repository:** `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite`  
**Mission:** An AI workflow and skills toolkit that installs/syncs skills, workflows, and agent resources across harnesses/IDEs.  
**Tech Stack:** Node.js ESM CLI, `commander`, `prompts`, `fs-extra`, `figlet`, asset-driven skill/workflow bundles under `assets/.agent/`.

Key packaging details from `package.json`:
- Package name: `takomi`
- Version: `2.0.5`
- CLI entry: `bin/takomi.js`

---

## 2. What Happened In The Previous Chat

The previous AI audited the in-house security skills in this repo, mainly:
- `assets/.agent/skills/security-audit/SKILL.md`
- `assets/.agent/skills/convex-security-audit/SKILL.md`
- `assets/.agent/skills/convex-security-check/SKILL.md`

Summary of the audit:
- The security skills are directionally useful but not yet trustworthy as deterministic security infrastructure.
- Biggest issues found:
  - `convex-security-audit` exposes rate-limit enforcement as a public Convex `mutation` instead of keeping it internal/helper-only.
  - `convex-security-check` incorrectly says env vars should be accessed only in actions.
  - `security-audit` is written like a runnable Bash playbook even though this environment is PowerShell on Windows.
  - Several examples are not copy-paste safe and appear unvalidated.
- Overall assessment from prior chat: useful internal draft, not production-grade security capability yet.

The human then said:
- they already built a code review tool a while ago
- they think that tool should be made more deterministic
- that tool should become the starting point instead of trying to build "true security stuff" directly from the current markdown security skills

This pivot is the most important context.

---

## 3. Repo Findings Relevant To The Pivot

I did **not** find the actual implementation of the old reviewer tool inside this repo.

What **is** present here:
- A Takomi skill wrapper for J-Star review:
  - `assets/.agent/skills/code-review/SKILL.md`
- A Takomi workflow that spawns J-Star reviewer setup:
  - `assets/.agent/skills/takomi/workflows/spawn-jstar-code-review.md`
- Historical references to `jstar-reviewer`, `.jstar/`, `jstar init`, `jstar review`, and headless review flows

Interpretation:
- This repo likely contains the orchestration layer and documentation for the review tool, not the review engine itself.
- The actual reviewer may live in:
  - another repo
  - a globally installed CLI/package
  - an older unpublished local project

Do **not** assume the implementation is here unless you discover it explicitly.

---

## 4. High-Value Files To Read First

- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\README.md`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\package.json`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\assets\.agent\skills\code-review\SKILL.md`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\assets\.agent\skills\takomi\workflows\spawn-jstar-code-review.md`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\assets\.agent\skills\security-audit\SKILL.md`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\assets\.agent\skills\convex-security-audit\SKILL.md`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\assets\.agent\skills\convex-security-check\SKILL.md`
- `C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\task.md`

---

## 5. Recent Milestones

Recent git history suggests the repo focus has been:
- unified Takomi router skill/workflow system
- rebrand from VibeSuite/VibeCode to Takomi
- global skills router and harness sync
- skill suite expansion and restructuring

Recent commits:
- `68d40cb` feat: add unified takomi skill with all workflow playbooks
- `736dc98` feat: rebrand vibesuite to takomi and add visionary mode
- `13e60bb` feat(agents): add global brand namer skill and takomi rebrand documentation
- `cbd7a65` docs: add Global Skills Router v2.0 documentation and CLI reference
- `9befb0b` feat: release v2.0 with visionary/orchestrator modes and global harness routing

---

## 6. Recommended Next Objective

Do **not** start by polishing the current security markdown skills.

Start here instead:

**Primary objective:** Find the real code review tool and evaluate how to make it deterministic enough to serve as the enforcement core for security/code-review workflows.

That means:
- locate the actual reviewer codebase or installed package
- inspect its CLI contract, headless mode, rule format, scoring, and output schema
- determine what makes it non-deterministic today
- design a deterministic core around:
  - fixed rule inputs
  - stable file selection
  - reproducible severity taxonomy
  - structured JSON output
  - snapshot/fixture testing
  - explicit false-positive handling

---

## 7. Working Hypothesis

The right architecture is probably:
- `review engine` as the real source of truth
- `security skills` as thin wrappers over that engine
- `markdown skills` only for orchestration and explanation

In other words:
- move security logic out of prose
- move rules into versioned, testable data/config
- move findings into deterministic machine-readable output

---

## 8. First Concrete Actions For The New AI

1. Search local machine/workspace for the old review tool implementation, especially anything named:
   - `jstar`
   - `jstar-reviewer`
   - `reviewer`
   - `.jstar`
2. If not found in this repo, ask the human for the repo/path/package of that old review tool.
3. Once located, audit it for determinism:
   - where model variance enters
   - what inputs are implicit
   - whether prompts/rules are versioned
   - whether output is structured and testable
4. Produce a concrete plan for turning it into the security/review backbone.

---

## 9. Constraints And Notes

- Environment observed in this chat: Windows PowerShell, repo path above.
- Do not assume Unix-only commands are acceptable.
- Do not assume the security skills themselves are the right foundation.
- The human explicitly wants to use the older code review tool as the starting point.

---

## 10. Suggested Opening Message In The New Chat

"I've loaded the migration snapshot. I understand the pivot: the goal is no longer to refine the current markdown security skills first, but to locate your older code review tool and turn that into a more deterministic review/security engine. I'll start by finding the actual reviewer implementation and mapping the current wrappers around it."

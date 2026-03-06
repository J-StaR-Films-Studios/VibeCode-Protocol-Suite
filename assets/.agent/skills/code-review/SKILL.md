---
name: code-review
description: Deprecated compatibility alias for J-Star Reviewer. Use `jstar-reviewer` for the canonical install, review, audit, and automation flows.
---

# Code Review (Deprecated)

This skill is kept only for backward compatibility with older Takomi prompts and habits.

Use `jstar-reviewer` as the canonical skill for:
- installing the `jstar-reviewer` npm package
- setting up `.jstar/`, `.env.local`, and `.gitignore`
- running `review` and `audit`
- using `--json` and `chat --headless` automation flows

## Redirect Rule

If this skill is invoked, treat it as a redirect to `jstar-reviewer`.

Do not use this file as the authoritative J-Star workflow documentation.

## Operational Rule

`review` and `audit` are separate steps.

If the user wants a serious verification pass, run both:
1. `review` for code review findings and fix prompts
2. `audit` for deterministic security audit findings

## Canonical References

- `assets/.agent/skills/jstar-reviewer/SKILL.md`
- `assets/.agent/workflows/spawn-jstar-code-review.md`
- `assets/.agent/workflows/review_code.md`

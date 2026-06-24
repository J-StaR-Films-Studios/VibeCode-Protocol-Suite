---
name: exam-creator-skill
description: Creates and revises school exam papers using Johno's preferred workflow. Use for JSS/Primary exam generation, remixing questions from lesson notes or chat transcripts, building question papers plus marking schemes, creating assets folders for diagrams, applying the 40-mark house style, producing compact DOCX output, and running draft/marking/verification passes with room for user feedback and revisions.
---

# Exam Creator Skill

Use this skill when building or revising school exam papers, especially for OBHIS / Olive Blessed Crest Academy.

See the detailed house rules in [references/workflow-rulebook.md](references/workflow-rulebook.md).
See the model routing policy in [references/model-routing-policy.md](references/model-routing-policy.md).

## Core Principle

Follow the user's house style by default, but always leave room for correction. If the user gives a new rule, prefer the new rule and update the working assumptions before generating more papers.

Terminology rule: when the user says **Gemini**, treat that as **Gemini via the agy CLI** unless the user explicitly says otherwise.

## Default Workflow

1. **Identify the subject, class, term, and destination folder.**
2. **Collect the authority material**:
   - lesson notes
   - ChatGPT transcripts
   - sample exam layout if provided
3. **Confirm the paper pattern before drafting** if any of these are unclear:
   - subject family (Mathematics/English vs other subjects)
   - mark split
   - question counts
   - whether theory is answer-all or answer-any
4. **Create or reuse clean folders**:
   - `Questions/`
   - `Marking Scheme/`
   - `Questions/assets/` for all generated SVG/PNG diagrams
5. **Draft the paper first.**
6. **Create the marking scheme second.**
7. **Run an independent verification pass third.**
8. **Apply user feedback and rerender** instead of defending the first draft.

## Preferred Multi-Agent Pattern

Default model split:
- orchestrator: parent assistant
- drafting: Gemini via agy CLI by default, escalate to GPT 5.4 High when the paper is tricky
- marking: Gemini via agy CLI
- verification: GPT

When subagents are available, use this split:

- **Drafting agent**: creates the paper and diagram assets.
- **Marking agent**: creates the marking scheme and validates every objective answer.
- **Review agent**: independently rechecks answers, numbering, marks, wording, and diagram correctness.

If subagents are not available, still preserve the same three-pass logic manually.

## House Rules To Hardcode

### 1) Marks and paper shape

#### Mathematics and English
Use this as the default unless the user overrides it:

- total exam score: **40 marks**
- **50 objective questions**
- each objective = **1/2 mark**
- objective total = **25 marks**
- **5 theory questions**
- student answers **any 3**
- theory total = **15 marks**
- no separate Section B short-answer block unless the user explicitly asks for one

#### Other subjects
Default assumption:

- still over **40 marks** total
- can include open-ended plus theory sections
- if the exact split is not stated, ask before finalizing

Never silently reuse the old 100-mark structure unless the user explicitly asks for it.

### 2) Layout rules

For the final paper DOCX, prefer:

- **Times New Roman**
- **12 pt** body text by default
- narrow margins
- **1-column header**, **2-column body** where it helps fit the paper
- bold black headings instead of oversized decorative headings
- objective options kept inline or compact on the next line, not vertically stacked unless unavoidable
- remove explicit `Total Marks: ...` header line unless requested
- target about **2 pages** per paper where practical

### 3) Diagram rules

- Keep all generated figures inside `Questions/assets/`.
- Create diagrams as SVG first; generate PNG copies if DOCX rendering needs them.
- Keep angle labels and vertex labels clearly visible.
- Avoid placing numbers directly on triangle edges.
- If labels are cramped, move them outward and add white-backed label boxes if needed.

### 4) Feedback loop

After each significant draft:

- expect user corrections
- revise quickly
- update the source files and rerender the DOCX
- if the DOCX is locked/open, save a `v2` file rather than failing the task

## Output Expectations

For each subject batch, try to maintain:

- editable paper source, usually `questions.md`
- concise support/source metadata if useful
- final DOCX for the paper
- marking scheme source
- final DOCX for the marking scheme when requested
- objective-validation notes
- verification report
- all diagrams in `Questions/assets/`

## Authoring Guidance

- Keep questions standard and school-appropriate.
- Remix questions reasonably from the provided curriculum material.
- Stay within the authority source unless the user allows expansion.
- Make objective questions unambiguous.
- Ensure the marking scheme matches final numbering exactly.
- For diagrams, refer to them consistently as Diagram A, B, C, etc.

## Required Clarifications

Ask the user before proceeding when any of the following is missing:

- subject
- class level
- authority source
- sample layout path if layout matching matters
- exact marks pattern for non-Math/non-English subjects
- desired final format if not obvious

## Safe Revision Rules

When updating an already-generated paper:

1. revise the editable source first
2. revise the marking scheme next if numbering/marks changed
3. rerun validation/verification if answers, wording, or diagrams changed
4. rerender DOCX last

## Reference

Load and follow [references/workflow-rulebook.md](references/workflow-rulebook.md) when you need the exact house style details.
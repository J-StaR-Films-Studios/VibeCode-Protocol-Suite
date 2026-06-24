# OBHIS Exam Workflow Rulebook

This reference captures the current house style agreed during the Mathematics paper workflow.

## Scope

Use this rulebook for OBHIS / Olive Blessed Crest Academy exam generation unless the user gives a newer rule.

## Terminology Rule

When the user says **Gemini**, interpret that as **Gemini via the agy CLI** unless the user explicitly says otherwise.

## Workflow Summary

1. Gather source materials.
2. Confirm subject-specific mark pattern.
3. Create clean folder structure.
4. Draft question paper.
5. Build marking scheme.
6. Independently verify.
7. Incorporate user feedback.
8. Rerender deliverables.

## Folder Structure

Preferred output structure:

- `Questions/`
  - `questions.md`
  - final exam `.docx`
  - `assets/`
    - all SVG diagrams
    - all PNG diagram copies used for Word export
- `Marking Scheme/`
  - `marking-scheme.md`
  - `objective-validation.md`
  - `verification-report.md`
  - marking-scheme `.docx` if needed

## Subject Rules

### Mathematics and English

Default pattern:

- exam total = **40 marks**
- objective count = **50**
- objective marks = **0.5 each**
- objective total = **25 marks**
- theory questions = **5**
- answer any = **3**
- theory total = **15 marks**
- no separate short-answer section by default

### Other Subjects

Current preference:

- may still use open-ended and theory sections
- still intended to fit the 40-mark exam system
- exact split should be clarified before final generation if not explicitly stated

## Layout Rules

- use **Times New Roman**
- default body size **12 pt**
- narrow margins
- compact layout
- header can stay 1-column
- body can be 2-column
- headings should be bold and black, not oversized
- objective options should appear inline or compactly, not stacked unless unavoidable
- remove `Total Marks` line unless requested
- try to keep each paper around **2 pages** where practical

## Diagram Rules

- store diagrams in `Questions/assets/`
- prefer SVG masters plus PNG export copies
- labels must be readable
- angle values must not be hidden by edges
- move text away from lines when needed
- rerender diagrams if the user reports visibility problems

## Review Rules

- objective answer validation is mandatory
- marking scheme must match final numbering
- verification should independently confirm correctness
- if a wording ambiguity is found, fix the paper and then realign the scheme

## Feedback Rules

- user feedback overrides previous assumptions
- update future papers to follow the corrected rule
- if a DOCX is locked, save a versioned file such as `v2`

## Notes

This rulebook is intentionally opinionated because it represents Johno's workflow. Keep it flexible enough to ask follow-up questions whenever a new subject or mark pattern does not clearly fit the stored defaults.
---
description: Build Takomi MUS requirements from their FR issues, verify each slice, and write a standard handoff
---
# Workflow: Vibe Build

Implement the approved Genesis plan and, when UI is involved, the approved Design artifacts. Keep the scope to the current MUS requirements or assigned task. Do not depend on an optional external skill to supply the workflow.

## 1. Load the project contract

Read repository instructions and, by default, `docs/Project_Requirements.md`, `docs/Coding_Guidelines.md`, `docs/Builder_Prompt.md`, relevant `docs/issues/FR-XXX.md`, and the matching `docs/mockups/` files when they exist. Read the code and tests before editing. If an established project uses different locations, follow its existing files and record the mapping rather than silently creating duplicates.

For a full-project Build, use the MUS FR IDs in the PRD as the work list. Future FRs remain outside Build unless the user approves them. For a focused follow-up, use the assigned FR or task instead of restarting the whole MUS sequence.

## 2. Prepare work before delegation

Author each orchestration task packet in markdown before launching it. Name the FR IDs and mockups it covers, objective, scope boundaries, dependencies, expected files, definition of done, verification commands, and applicable security or data constraints. Repair placeholder Scope, Definition of Done, or Expected Artifacts sections before dispatch. JSON tracks status, models, and continuity; it does not replace the packet.

## 3. Implement MUS requirements in order

For each MUS FR in the approved Build scope, follow this loop. For a focused task without an FR, use its task packet and the same acceptance, implementation, and verification steps.

1. Open the corresponding `docs/issues/FR-XXX.md` or assigned task packet and check its approach and acceptance criteria against the current code. Flag a missing or contradictory requirement before guessing.
2. Implement the smallest complete slice using the agreed stack and `docs/Coding_Guidelines.md`. Scaffold a new app only if the plan calls for one. Match relevant mockups, while honoring accessibility, responsiveness, and explicit product requirements.
3. Add focused tests for changed behavior and meaningful failure cases. Run the relevant checks after the FR or task slice, fix regressions, and record which acceptance criteria passed. Mark completed criteria in the issue or task file; leave unfinished ones unchecked with a reason.
4. After every three completed FRs, or at the end of a smaller batch, report the completed IDs, checks run, blockers, and next IDs. Do not claim a pass for a command that was not run.

Preserve unrelated user work. If a requirement needs a major architecture change, expanded scope, production data mutation, or deployment, pause for approval. Review the diff for unnecessary code before handoff.

## 4. Verify and hand off

Run the project's typecheck, tests, lint, and build as applicable. Use `scripts/vibe-verify.py` when this project provides it; otherwise use its documented verification commands. Record failures honestly, including whether they predate this work. Deploy only with explicit authorization and a confirmed target.

For a full-project Build, create or update `docs/Builder_Handoff_Report.md` with:

- MUS FR IDs completed, partially completed, and pending, linked to their issue files
- files and behavior changed, including UI mockups used
- commands run and their results, plus how to run the project
- remaining Future work, blockers, and the recommended review or next Build step

For a focused follow-up, update the existing handoff report if it tracks that feature; otherwise a concise task handoff is enough. Never announce a finished MUS or deployment while its acceptance criteria or verification are still open.

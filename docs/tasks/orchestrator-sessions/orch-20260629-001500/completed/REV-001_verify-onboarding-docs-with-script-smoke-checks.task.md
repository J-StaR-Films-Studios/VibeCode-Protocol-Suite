# REV-001 - Verify onboarding docs with script smoke checks

## Objective

Review the new onboarding docs against actual plugin files and verify documented commands with non-mutating detection, policy, doctor, and board status commands.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [x] Confirm documented file paths exist.
- [x] Run non-mutating smoke checks for detection, policy, doctor, and roadbook status.
- [x] Confirm commands use `pwsh` where `takomi-board.ps1` is involved.
- [x] Check docs do not imply user/global config writes happen without approval.
- [x] Record unresolved risks or follow-up fixes.

## Notes

Lifecycle: Review. Include the Windows PowerShell 5 versus PowerShell 7 note for takomi-board.ps1.

Suggested smoke checks:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-detect.ps1 -Root .
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-policy.ps1 -Root .
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-doctor.ps1 -Root .
pwsh -NoProfile -ExecutionPolicy Bypass -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root . -Action show -SessionId orch-20260629-001500
```

## Update 2026-06-29T01:03:47

Started final docs review and non-mutating smoke checks. Delegating review to a separate agent.

## Review Findings

Delegated review found three docs consistency issues:

1. `docs/features/Codex_Takomi_Plugin.md` still used direct PowerShell script invocation in old verification examples.
2. `Orchestrator_Summary.md` had stale task counts.
3. `master_plan.md` still described onboarding gaps and next build task text after the guide and entry-point docs were complete.

Applied fixes:

- Updated feature-doc verification commands to use `pwsh -NoProfile -ExecutionPolicy Bypass -File`.
- Updated the master plan from planned gaps to completed outcomes.
- Will refresh `Orchestrator_Summary.md` after this review task is completed.

Smoke checks run by the review agent:

```powershell
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-detect.ps1 -Root .
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-policy.ps1 -Root .
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-doctor.ps1 -Root .
pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-board.ps1 -Root . -Action show -SessionId orch-20260629-001500
python C:\Users\johno\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py C:\CreativeOS\01_Projects\Code\Personal_Stuff\2025-12-02_VibeCode-Protocol-Suite\plugins\takomi-codex
```

Result: all checks passed before final cleanup. Parent reran final checks after the cleanup.

## Update 2026-06-29T01:08:16

Completed final docs review. Applied review cleanup for pwsh verification examples and stale roadbook language. Final detect, policy, doctor, board show, and plugin validator checks passed.

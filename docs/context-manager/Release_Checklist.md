# Takomi Context Manager Release Checklist

## Package Decision

`takomi-context-manager` should ship with the Pi bundle because it protects Takomi's runtime prompt budget and subagent model-routing behavior.

Included via `package.json`:

```json
"files": [
  ".pi/extensions"
]
```

Explicitly not shipped as defaults:

- `.pi/takomi/policies/`
- `.pi/takomi/context-manager/`
- `.pi/takomi/model-routing.md`
- `.pi/settings.json`

Those are user/project state. They are excluded by `.gitignore` and `.npmignore` where applicable.

## Pre-Publish Checks

- [x] `.pi/extensions/takomi-context-manager/` exists and is modularized.
- [x] `src/pi-installer.js` automatically installs every bundled directory under `.pi/extensions/`, including `takomi-context-manager`.
- [x] `takomi install pi` / `takomi sync pi` run `pi update` to refresh Pi-managed packages such as `pi-subagents`.
- [x] `takomi doctor` reports bundled/installed `takomi-context-manager`.
- [x] README documents the context manager.
- [x] `.pi/README.md` documents bundled extension behavior.
- [x] `.npmignore` excludes local context-manager/policies state.
- [x] `docs/context-manager/Test_Report.md` exists.
- [x] Targeted TypeScript check shows no context-manager errors.
- [x] Pi dev smoke test passes with `scripts/pi-dev.ps1 --help`.
- [ ] Run manual interactive tests before final publish.
- [x] Run `npm pack --dry-run` and inspect included files.
- [x] Confirm package version bump before `npm publish` (`2.1.8`).
- [ ] Confirm npm auth and target tag.

## Manual Interactive Tests

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

Then verify:

1. `context_report` shows prompt reduction and no unexpected warnings.
2. `skill_index` returns names only.
3. `skill_manifest takomi optimize-agent-context` returns descriptions/locations only.
4. `skill_load takomi` returns full `SKILL.md`.
5. `policy_manifest model-routing` points to `.pi/takomi/model-routing.md` when routing exists.
6. `takomi_subagent` before policy load returns policy and retry guidance.
7. wrong-provider equivalent model is corrected to policy provider.
8. invalid model/provider opens human recovery prompt.
9. choosing stop aborts the turn and waits for next user prompt.
10. `context_report` surfaces duplicate global/project extension warnings if present.

## Publish Notes

Recommended publish sequence:

```bash
npm pack --dry-run
npm version patch
npm publish
```

Only publish after reviewing the dry-run file list and confirming no local project state is included.

## Latest Dry-Run Result

`npm pack --dry-run --json` confirmed:

- package: `takomi@2.1.8`
- `.pi/extensions/takomi-context-manager/index.ts` is included
- `.pi/extensions/takomi-context-manager/model-policy-gate.ts` is included
- `.pi/extensions/takomi-runtime/index.ts` is included
- `.pi/takomi/context-manager/config.json` is not included
- `.pi/takomi/policies/subagent-routing.md` is not included
- `.pi/takomi/model-routing.md` is not included
- `.pi/settings.json` is not included

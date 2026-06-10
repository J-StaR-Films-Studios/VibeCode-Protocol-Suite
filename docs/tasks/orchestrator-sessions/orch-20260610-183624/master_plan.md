# Orchestrator Master Plan

## Overview
- **Session id:** orch-20260610-183624
- **Product/project:** Takomi / Pi resource installer and refresh flow
- **Mission:** Reframe Takomi skills/workflows installation so users select categorized resource packs instead of receiving every bundled skill by default, and make refresh/sync prune only Takomi-owned deselected resources.
- **Current phase:** Genesis intake and feature definition
- **Recommended next phase:** Design, then Build

## Context Intake
### Source of truth
- User request: stop installing all bundled skills by default, especially AI media/content skills (`ai-avatar-video`, `ai-marketing-videos`, `ai-podcast-creation`, `ai-product-photography`, `ai-sdk`, `ai-social-media-content`, `ai-voice-cloning`) unless selected.
- Pi docs reviewed:
  - `docs/skills.md`: Pi discovers skills from `~/.pi/agent/skills`, `~/.agents/skills`, project skill folders, packages, settings, and CLI `--skill` paths.
  - `docs/packages.md`: Pi package filters can enable/disable resources, but Takomi’s own CLI currently copies bundled resources into harness folders/global skill dirs.
  - `docs/extensions.md`: extension UI can support richer selection flows, though the immediate issue is CLI installer/resource ownership.
- Repository scan:
  - `src/skills-installer.js` currently installs every bundled skill into `~/.agents/skills` and overwrites/removes existing dest folders.
  - `src/cli.js` maps `takomi setup skills`, `takomi refresh skills`, and `takomi refresh all` to all-skills installation.
  - `src/store.js` has `populateSkills('core'|'all'|custom)` but core includes `ai-sdk`; it does not prune deselected resources.
  - `src/harness.js` syncs every item in `~/.takomi/skills` to harness targets but does not remove Takomi-owned resources that were deselected.
  - `src/utils.js` has all/core/custom copy helpers, but ownership-aware deletion is not centralized.

### Desired behavior captured
1. Default install/refresh must **not** install all skills automatically.
2. The listed AI media/content skills should be categorized as optional/non-default, not hidden forever.
3. Skill and workflow installation should use a categorized selector.
4. Re-running install/setup/refresh and deselecting a Takomi-installed skill should remove it from the destination.
5. Removal must be ownership-safe: delete only resources that Takomi installed/tracked, never manually added user skills/workflows.
6. This should apply beyond Pi/Takomi harness setup: global skills, workflows, store sync, and installer refresh paths should share the same resource selection and ownership model.

## Task Table
| # | Subtask | Mode/Role | Workflow | Overlays | Dependency | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | Capture installer/selectivity requirements and repo scan | Orchestrator | vibe-genesis | Pi docs | None | completed |
| 02 | Design resource taxonomy, selection UX, and ownership manifest | Architect/Designer | vibe-design | None | 01 | pending |
| 03 | Implement categorized selection and ownership-safe prune | Coder | vibe-build | None | 02 | pending |
| 04 | Add tests/fixtures for install, refresh, sync, and manual resource preservation | Coder/Reviewer | vibe-build/review | None | 03 | pending |

## Progress Checklist
- [x] Parse user intent and specific excluded-by-default skills.
- [x] Scan installer/resource code paths.
- [x] Review relevant Pi docs for skills/packages/extensions behavior.
- [x] Create Takomi orchestration session for the feature.
- [ ] Produce design spec for resource packs and ownership-safe reconcile.
- [ ] Implement shared resource selection model.
- [ ] Verify refresh/install never installs all skills unless explicitly selected.
- [ ] Verify deselection prunes only Takomi-owned resources.
- [ ] Update user docs and CLI help.

## Notes
- Treat the listed AI content skills as optional category members, not as removed/deleted assets.
- `ai-sdk` is currently in “core” in both `src/cli.js` project setup and `src/store.js`; design should decide whether it belongs in Essentials, Developer/AI SDK optional, or is selected only when relevant.
- The safest deletion rule should be: remove a destination resource only when a prior Takomi manifest records ownership of that exact resource and its current content matches either the recorded hash or an expected Takomi-managed replacement policy. If modified by the user, preserve and warn.

# Takomi Skills Curation - Agent Handoff

## Your Mission

Audit newly installed skills in `.agent/skills/`, then:
1. **Review each skill's SKILL.md** - Is it high-quality? Does it duplicate existing skills?
2. **Copy approved skills** to `assets/.agent/skills/`
3. **Clean up** by removing from `.agent/skills/` after copying
4. **Update README.md** - Add to Full Suite install command (alphabetically) + acknowledgements
5. **Update personal.md** - Track source and category
6. **Update this file** with new counts

## Current State

**Total Skills in Assets: 68**

### Recently Verified / Added
- `21st-dev-components` is present in the bundled assets and included in `npm pack --dry-run`
- README install commands now mention the expanded free-skill bundle, including `global-brand-namer` and `jstar-reviewer`
- Package metadata now reflects in-house ownership (`UNLICENSED`) and the CLI version matches `package.json`
- Added a dedicated feature doc: `docs/features/21st_Dev_Components.md`

### Distribution Snapshot
- **Takomi originals / in-house**: `21st-dev-components`, `takomi`, `global-brand-namer`, `jstar-reviewer`, `gemini`, plus the core Takomi/VibeCode workflow skills
- **Imported suites**: Anthropic, Vercel, Expo, coreyhaines31/marketingskills, inference.sh, waynesutton/convexskills, Google Stitch, Remotion, Jules, obra/superpowers, squirrelscan, upstash, and Next Level Builder

### Personal (NOT distributed)
- `brainstorming` - covered by `/mode-architect`
- `develop-ai-functions-example` - internal SDK dev tool

### Skipped This Session
- `code-reviewer` - duplicates existing `code-review`
- `context-driven-development` - too niche (Conductor framework)
- `youtube-clipper` - Chinese-first, very specific workflow

## Review Criteria

✅ **Keep if:**
- High-quality documentation
- Unique functionality (not duplicating existing skills)
- Practical for Takomi users

❌ **Flag/Skip if:**
- Thin content (just conceptual, no tooling)
- Duplicates existing skill
- Too niche/personal

## Pending

- [ ] Check `.agent/skills/` for new installs
- [ ] Commit all changes when done
- [ ] Publish updated package after final manual install/push/publish run

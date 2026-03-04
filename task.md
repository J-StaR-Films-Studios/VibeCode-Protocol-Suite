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

**Total Skills in Assets: 47**

### Distributed Skills (by source)
- **Anthropic (11)**: algorithmic-art, crafting-effective-readmes, docx, domain-name-brainstormer, frontend-design, monorepo-management, pdf, pptx, skill-creator, webapp-testing, xlsx
- **Vercel (2)**: ai-sdk, web-design-guidelines
- **Expo (2)**: building-native-ui, upgrading-expo
- **coreyhaines (5)**: copywriting, marketing-ideas, pricing-strategy, programmatic-seo, social-content
- **inference.sh (7)**: ai-avatar-video, ai-marketing-videos, ai-podcast-creation, ai-product-photography, ai-social-media-content, ai-voice-cloning, twitter-automation, prompt-engineering
- **obra (1)**: subagent-driven-development
- **squirrelscan (1)**: audit-website
- **upstash (1)**: context7
- **Custom (1)**: gemini
- **Original VibeCode (15)**: agent-recovery, code-review, component-analysis, git-worktree, github-ops, google-trends, high-fidelity-extraction, nextjs-standards, remotion, security-audit, seo-ready, spawn-task, sync-docs, ui-ux-pro-max, youtube-pipeline

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

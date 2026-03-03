# 🔄 Takomi Rebrand — Agent Task Prompt

> **Give this entire prompt to an agent. It contains everything needed to rebrand the project.**

---

## Objective

Rebrand the **VibeCode Protocol Suite** repository to **Takomi** — a name derived from "Takumi" (Japanese: *Artisan / Master Craftsman*), chosen to replace the now-generic "VibeCode" branding while preserving the VibeCode philosophy as a subtitle/descriptor.

## Brand Identity Rules

| Element | Old | New |
|---------|-----|-----|
| **Project Name** | VibeCode Protocol Suite | **Takomi** |
| **CLI Package Name** | `vibesuite` | **`takomi`** |
| **npm bin command** | `vibesuite` | **`takomi`** |
| **Tagline** | "Code with the flow. Code with the vibe." | **"The Artisan's Toolkit for AI-Human Development"** |
| **Subtitle/Descriptor** | _(none)_ | **"Powered by the VibeCode Protocol"** |
| **GitHub Repo** | `JStaRFilms/VibeCode-Protocol-Suite` | **Leave as-is for now** (URL unchanged) |
| **Global Store Path** | `~/.vibesuite/` | **`~/.takomi/`** |

### Key Principle
- **"Takomi"** replaces "VibeCode" / "VibeSuite" as the **product brand name** everywhere.
- **"VibeCode Protocol"** is retained as a **subtitle, descriptor, or heritage reference** — NOT the primary brand. Think of it like how "Google Workspace" replaced "G Suite" but still says "by Google."
- All slash commands (`/vibe-*`, `/mode-*`) keep their names — those are workflow names, not brand names.
- Folder name `VibeCode-Agents` in `/assets/` should be renamed to `Takomi-Agents`.

---

## Files to Modify

### 🔴 Critical (Package Identity)

#### 1. `package.json`
- `"name": "vibesuite"` → `"name": "takomi"`
- `"bin": { "vibesuite": "./bin/vibesuite.js" }` → `"bin": { "takomi": "./bin/takomi.js" }`
- `"description"` → `"The Artisan's Toolkit for AI-Human Development — Powered by the VibeCode Protocol"`
- `"keywords"` → add `"takomi"`, keep `"vibecode"` for discoverability
- Leave `"repository"` URL as-is for now

#### 2. `bin/vibesuite.js` → Rename file to `bin/takomi.js`
- Contents stay the same (`#!/usr/bin/env node\nimport '../src/cli.js';`)

#### 3. `.project_meta.json`
- `"name": "VibeCode-Protocol-Suite"` → `"name": "Takomi"`
- `"slug"` → leave as-is (it's a local CreativeOS path reference)

---

### 🟡 CLI Source Code (`src/`)

#### 4. `src/cli.js` (~24KB)
- All `vibesuite` command references → `takomi`
- All `VibeSuite` display text → `Takomi`
- All `VibeCode` in UI strings/banners → `Takomi` (but keep "VibeCode Protocol" where it's used as a descriptor/philosophy reference)
- The figlet banner text (the ASCII art) should say `Takomi` instead of `VibeSuite` or `VibeCode`
- Help text, descriptions, examples in commander config

#### 5. `src/utils.js` (~13KB)
- All `vibesuite` path references → `takomi`
- All `VibeSuite` / `VibeCode` display strings → `Takomi`
- Any references to `~/.vibesuite/` → `~/.takomi/`

#### 6. `src/store.js` (~8KB)
- `~/.vibesuite/` store path → `~/.takomi/`
- All `VibeSuite` display text → `Takomi`

#### 7. `src/harness.js` (~9KB)
- All `vibesuite` path segments → `takomi`
- Harness detection paths that reference `vibesuite` → `takomi`

---

### 🟢 Documentation

#### 8. `README.md`
Apply these transformations **intelligently** — don't just find-replace blindly:

| Context | Transformation |
|---------|----------------|
| Main title `# VibeCode Protocol Suite` | → `# Takomi` |
| Subtitle `<h3>🤖 A Complete System...` | → `<h3>🤖 The Artisan's Toolkit for AI-Human Development</h3>` |
| Tagline `Code with the flow...` | → `Powered by the VibeCode Protocol` |
| CLI commands `pnpm dlx vibesuite install` | → `pnpm dlx takomi install` |
| CLI commands `npx vibesuite install` | → `npx takomi install` |
| CLI commands `vibesuite sync`, `vibesuite add`, etc. | → `takomi sync`, `takomi add`, etc. |
| Section header `## 🌟 What is VibeCode?` | → `## 🌟 What is Takomi?` |
| Body text "VibeCode isn't just..." | → "Takomi isn't just a collection of prompts..." (keep the philosophy, change the name) |
| "VibeCode Protocol Suite" as a descriptor | → "Takomi — the VibeCode Protocol Suite" or just "Takomi" |
| `~/.vibesuite/` paths | → `~/.takomi/` |
| `VibeSuite v2.0` | → `Takomi v2.0` |
| CLI table commands | → replace `vibesuite` with `takomi` |
| Bottom tagline | → `Built with ❤️ by artisans who code with the flow` |
| `npx -y skills add` commands | These reference the GitHub URL — leave the GitHub URL as-is |

#### 9. `docs/features/CLI_Resource_Installer.md`
- All `vibesuite` / `VibeSuite` / `VibeCode` references → `takomi` / `Takomi`

#### 10. `docs/tasks/Skill_Verification_Marathon.md`
- Any `VibeCode` branding references → `Takomi`

#### 11. `00_Notes/Idea.md`
- Historical context — update `VibeCode` brand references to `Takomi` where relevant, but this is a notes file so use judgment

#### 12. `prompt.md` / `task.md` / `personal.md`
- Update any `VibeCode` branding to `Takomi`

---

### 🔵 Agent Configs (`assets/VibeCode-Agents/`)

#### 13. Rename folder: `assets/VibeCode-Agents/` → `assets/Takomi-Agents/`

#### 14. Inside each YAML file (6 files):
- `custom_modes.yaml`
- `kilo-code-settings.json`
- `vibe-architect.yaml`
- `vibe-ask.yaml`
- `vibe-code.yaml`
- `vibe-debug.yaml`
- `vibe-orchestrator.yaml`
- `vibe-review.yaml`
- `vibe-visionary.yaml`

**For these files:** Update any display names or descriptions that say "VibeCode" → "Takomi". Keep the `vibe-*` prefixes on the mode names (those are workflow identifiers, not brand names).

---

### 🟤 Legacy Prompts (`assets/Legacy/`)

#### 15. These files contain "VibeCode" in titles and body:
- `0 VibeCode User Manual.md` — consider renaming to `0 Takomi User Manual.md`
- `1 Project Genesis Protocol The VibeCode Workflow.md` — update title and body
- `3 Design System Genesis Protocol.md` — update VibeCode references
- `5 The Escalation & Handoff Protocol.md` — update VibeCode references
- `8 The Seamless Migration Meta-Prompt (Your Reusable Tool).md` — update references

For Legacy files: Replace "VibeCode" with "Takomi" in headings and key references, but add a note like *"Part of the Takomi suite (formerly VibeCode Protocol Suite)"* at the top if needed.

---

### ⚫ Deep Source Prompts

#### 16. `Deep_Source_Prompts/Kilo mode prompt/code-export.yaml`
- Update VibeCode references

#### 17. `Deep_Source_Prompts/Kilo mode prompt/README.md`
- Update VibeCode branding

---

## What NOT to Change

1. **Slash command names** (`/vibe-genesis`, `/vibe-build`, `/mode-code`, etc.) — these are workflow identifiers, not branding
2. **GitHub repo URL** — leave `JStaRFilms/VibeCode-Protocol-Suite` as-is for now
3. **Skill folder names** — skills in `.agent/skills/` are independent capabilities
4. **Workflow file names** — `vibe-build.md`, `mode-code.md`, etc. stay as-is
5. **User's global memory rules** — those reference "VibeCode Protocol" which is the philosophy name, not the brand
6. **The `.agent/workflows/` folder** — workflow files reference "VibeCode" as a methodology, which is fine

---

## Verification Checklist

After completing all changes, run these checks:

1. **`grep -r "vibesuite" --include="*.js" --include="*.json" src/ bin/ package.json`** — should return 0 results (all replaced with `takomi`)
2. **`grep -r "VibeSuite" --include="*.md" --include="*.json" --include="*.js"`** — should return 0 results
3. **`grep -ri "VibeCode Protocol Suite" README.md`** — should return 0 results for standalone usage (only OK as a heritage reference like "formerly VibeCode Protocol Suite")
4. **Verify `package.json`** has `"name": "takomi"` and `"bin": { "takomi": "./bin/takomi.js" }`
5. **Verify `bin/takomi.js`** exists and `bin/vibesuite.js` is deleted
6. **Verify `assets/Takomi-Agents/`** folder exists and `assets/VibeCode-Agents/` is deleted
7. **Read `README.md`** end-to-end and confirm it reads naturally with Takomi branding
8. **Run `node bin/takomi.js --help`** and verify the CLI displays "Takomi" branding

---

## Tone Guide for Rewrites

When rewriting copy, follow this tone:

- **Before:** "VibeCode isn't just a collection of prompts—it's a complete workflow system"
- **After:** "Takomi isn't just a collection of prompts—it's the artisan's complete workflow system for collaborating with AI to build software. Built on the VibeCode Protocol."

- **Before:** "Code with the flow. Code with the vibe."
- **After:** "The Artisan's Toolkit for AI-Human Development"

- **Before:** "VibeSuite v2.0 introduces the Global Skills Router"
- **After:** "Takomi v2.0 introduces the Global Skills Router"

The energy is: **craftsmanship, mastery, precision, artisan quality** — not generic "vibe" energy anymore.

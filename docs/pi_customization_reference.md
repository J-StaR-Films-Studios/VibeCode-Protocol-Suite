# Pi Customization Reference

## Do you need to clone Pi itself?
No — not for normal customization.

Clone the Pi repo only if you want to:
- change Pi core behavior
- patch internals
- contribute upstream
- develop Pi itself

## Where to customize Pi
Use Pi’s config locations instead:
- Global: `~/.pi/agent/`
- Project-local: `.pi/` inside a repo

Common customizations include:
- `settings.json`
- `extensions/`
- `skills/`
- `prompts/`
- `themes/`
- `AGENTS.md` / `CLAUDE.md`
- `SYSTEM.md` / `APPEND_SYSTEM.md`

## Best way to make it portable
If you want a setup you can copy to another machine or reuse forever:
1. Put your Pi customizations in your own repo.
2. Keep them under `.pi/` or package them as a **Pi Package**.
3. Pin versions or git commits for reproducibility.
4. Use project-local installs when needed.

## Pi Packages
Pi Packages are the cleanest way to share:
- extensions
- skills
- prompt templates
- themes

They can be distributed via:
- npm
- git

## For a full portable setup
You can also override the Pi config directory with:
- `PI_CODING_AGENT_DIR`

That lets you store your full Pi setup in a custom folder, even one under version control.

## Recommendation
- **Personal use:** use `~/.pi/agent/` and/or `.pi/`
- **Reusable setup:** use your own repo + Pi Package
- **Sellable product:** package the workflow, don’t fork Pi unless necessary

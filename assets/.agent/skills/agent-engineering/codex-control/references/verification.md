# Verification and sources

These observations describe the installation tested while authoring this skill. Recheck capabilities after runtime or plugin changes.

## Observed results

| Probe | Result | Evidence |
| --- | --- | --- |
| Pi invokes Codex noninteractively | Passed | Codex CLI 0.159.2 returned JSONL events and a final report through `codex exec --ephemeral --json`. |
| Codex native Windows runtime initialization | Passed | Tool events showed Codex's `mcp__node_repl__js` importing `@oai/sky`. |
| Native app enumeration | Passed | Codex reported 41 apps from `sky.list_apps()`. |
| Native window enumeration | Passed | Tool events showed `sky.list_windows()` and selection of one existing Calculator window. |
| Read Calculator without activation | Blocked | `sky.get_window_state()` failed with `Computer Use was not approved to use Calculator.` No activation or input call was issued. |
| Use native browser plugin in existing personal browser | Blocked | Codex reported Browser/Chrome runtime files but empty skill directories and no documented initialization instructions. No native browser API was called. |
| Native GUI input, browser interactions, document tools, image generation | Untested | Do not infer success from plugin flags or the successful enumeration probes. |

The earlier Pi Windows-MCP and Playwright demonstrations do not count as Codex-native verification. This skill intentionally does not use those integrations.

Codex also emitted warnings for two unrelated, unrecognized `profiles.ollama-launch` settings. They were not changed and did not prevent the successful probes.

## Sources consulted

- [OpenAI computer-use documentation](https://developers.openai.com/codex/computer-use/): first-party setup and app permission context. Check current documentation before promising background operation.
- Installed `computer-use@openai-bundled` skill, version `26.928.21956`, and its `docs/guidance.md`, `docs/api.md`, and `docs/confirmations.md`: authoritative runtime instructions for the tested installation. Discover the current cache path rather than hardcode that version for execution.
- Installed Codex CLI `--help`, `exec --help`, and `queue --help`: delegation interface.
- [OpenAI Playwright skill](https://github.com/openai/skills/tree/main/skills/.curated/playwright): browser CLI workflow, not a bridge to Codex's native desktop/browser runtime.
- [OpenAI interactive Playwright skill](https://github.com/openai/skills/tree/main/skills/.curated/playwright-interactive): requires its documented `js_repl` environment; not a drop-in Pi integration.
- [Pi browser-tools skill](https://github.com/badlogic/pi-skills/tree/main/browser-tools): CDP browser scripts, not the requested Pi-to-Codex delegation.

This is an original Pi delegation skill, not a copied OpenAI runtime skill. Its examples are intended workflows, not proof that missing native plugins have been repaired.

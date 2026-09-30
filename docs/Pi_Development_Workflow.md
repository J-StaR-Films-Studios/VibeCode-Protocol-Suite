# Pi Development Workflow

When developing Takomi itself, do **not** run plain `pi` from the repository root if the global Takomi harness is installed.

Pi discovers extensions from both places:

- global: `~/.pi/agent/extensions`
- project-local: `<repo>/.pi/extensions`

Because this repository contains the same Takomi extensions that are installed globally, plain `pi` from the repo root can load both copies and produce tool conflicts such as:

```txt
Tool "takomi_workflow" conflicts
Tool "takomi_board" conflicts
Tool "takomi_subagent" conflicts
```

## Recommended workflow

### Normal user testing

Use the packaged global harness from any non-Takomi project directory:

```powershell
takomi install pi
cd C:\path\to\some\test-project
takomi
```

### Takomi extension development

From this repository, just run:

```powershell
takomi
```

The Takomi launcher recognizes its source checkout and starts Pi with one complete project-local set:

```txt
--no-extensions
--extension .pi/extensions/oauth-router/index.ts
--extension .pi/extensions/takomi-runtime/index.ts
--extension .pi/extensions/takomi-subagents/index.ts
--extension .pi/extensions/takomi-context-manager/index.ts
--extension .pi/extensions/notify-sound/index.ts
--extension .pi/extensions/antigravity-provider/index.ts
--extension .pi/extensions/takomi-vault/index.ts
--no-prompt-templates
--prompt-template .pi/prompts
--no-themes
--theme .pi/themes/takomi-noir.json
```

This source-checkout launch disables automatic extension discovery and loads the listed local extension paths. It avoids loading a second global copy through this launch path. `context_report` can also warn when known global and project extension paths overlap, but that path-based warning does not prove both copies registered during a particular run. Plain `pi` cannot express this conditional behavior through `.pi/settings.json`: project settings can control project resources, but cannot conditionally disable matching user-global extensions.

The PowerShell script remains an equivalent fallback for passing raw Pi arguments:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

You can pass normal Pi arguments after the script name:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1 --version
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1 -p "Say ok"
```

## About `scripts/sync-pi-global.ps1`

`scripts/sync-pi-global.ps1` is useful when you intentionally want the global harness to point at your working tree via junctions.

Use it only as a local development convenience. It is not the recommended default for package validation because `takomi install pi` is supposed to overwrite/sync the packaged distribution into `~/.pi/agent`.

If you run `takomi install pi`, expect it to replace those development links with packaged copies. Re-run `scripts/sync-pi-global.ps1` only when you want to return to linked local development mode.

## Adding a new extension

There is no central registry. Add each extension to the explicit source-checkout lists:

1. `scripts/pi-dev.ps1` — add the extension path and its existence check.
2. `src/pi-harness.js` (`getSourceCheckoutLaunchArgs`) — add the matching path for the repository's `takomi` launcher.
3. `scripts/sync-pi-global.ps1` — add the global development junction for testing through normal Pi discovery.

Miss a list and the extension may load in one launch path but not another. Check all three.

## Pi version in development

Both source-checkout launchers require the repository's local `@earendil-works/pi-coding-agent`; the PowerShell script checks that executable and invokes it with Node, and the `takomi` wrapper stops if it is missing. Both pass explicit local extension paths with automatic discovery disabled. The remediation worktree has all four Pi packages pinned to 0.99.1 and `pi-subagents` 0.31.0. Those are the local tested versions, not a claim about any global Pi installation. No global Pi installation is changed by this workflow.

The explicit list prevents duplicate discovery in this source-checkout launch. A diagnostic warning based on overlapping global/project paths is only a hint; it does not establish that duplicate registrations occurred in a given process. Do not remove a global installation based on that warning alone.

When a new extension is missing, confirm which launcher ran and inspect its explicit arguments. Run the checkout directly (`node bin/takomi.js` from root) or use `scripts/pi-dev.ps1` for the source loop. Do not `npm link` as a workaround; it makes every dirty edit instantly live in your global install.

## Do not edit `~/.pi` as the source of truth

Keep source changes in the repository:

- `.pi/extensions/**`
- `.pi/agents/**`
- `.pi/prompts/**`
- `.pi/themes/**`
- `src/pi-takomi-core/**`

Treat `~/.pi` as an installed output directory, not as the canonical source.

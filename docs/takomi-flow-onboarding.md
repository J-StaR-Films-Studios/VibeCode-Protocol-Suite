# TakomiFlow Onboarding

TakomiFlow is packaged in this repo at `plugins/takomi-flow`.

## First Run

1. Install or register the plugin:

   ```powershell
   ./scripts/install-takomi-flow.ps1 -InstallDependencies
   ```

2. Check the local runtime:

   ```powershell
   node plugins/takomi-flow/scripts/takomi-flow.mjs doctor
   ```

3. Check whether a trusted Chrome instance is already running:

   ```powershell
   Invoke-WebRequest http://127.0.0.1:9222/json/version -UseBasicParsing
   ```

4. If Chrome is already running on port `9222`, reuse it with:

   ```powershell
   --cdp-url http://127.0.0.1:9222
   ```

5. If Chrome is not running, launch it:

   ```powershell
   node plugins/takomi-flow/scripts/takomi-flow.mjs trusted-chrome
   ```

6. Sign into Google Flow manually in the opened browser.

7. Run a no-spend observe before generation:

   ```powershell
   node plugins/takomi-flow/scripts/takomi-flow.mjs observe --allow-browser --cdp-url http://127.0.0.1:9222
   ```

## MCP Or CLI

- If the harness supports MCP, use TakomiFlow MCP tools.
- If MCP is unavailable, use the CLI commands directly.
- If a harness has neither MCP nor shell access, use the skill instructions as a handoff checklist for a human/operator.

Generation is always spend-gated. Use `--allow-spend` only after explicit approval.

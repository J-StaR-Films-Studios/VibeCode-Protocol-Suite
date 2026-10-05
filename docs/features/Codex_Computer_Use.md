# Optional Codex computer use

## Goal

Let Windows users opt into desktop control from Takomi/Pi, using their own installed Codex runtime or a compatible MCP server they already configured. Ship the integration as Takomi-owned code. Preserve Codex's configuration, provider-owned binaries, existing MCP registrations, and unrelated Pi settings.

## Install and use

Requires Windows, a supported Node/Pi installation, and either the installed Codex desktop app with its desktop plugin enabled or a compatible existing desktop MCP. Keep Windows unlocked.

```powershell
# Interactive setup, then fully restart Pi.
takomi setup computer-use

# Reuse a named user-level Pi stdio server.
takomi setup computer-use --server codex-computer-use

# Explicit unattended opt-in, still subject to runtime app approval.
takomi setup computer-use --server codex-computer-use --yes

# If Codex is absent from PATH, supply its executable or npm entry script.
takomi setup computer-use --codex-cli "C:\\path\\to\\codex.exe"

takomi computer-use doctor
takomi computer-use config
takomi computer-use disable
```

Setup checks desktop inventory before enabling the feature. It installs pinned dependencies under `~/.pi/agent/extensions/takomi-computer-use/` with lifecycle scripts disabled. It backs up valid existing feature configuration before replacing it. No computer-use setup runs during npm postinstall or recommended-default feature installation.

Existing servers must expose `js` with the Codex `nodeRepl` and `@oai/sky` interface. The installer reads the user-level Pi registry. It stores a reference to the chosen registration, not a copy of credentials or environment values. Environment values support `${NAME}` substitutions, but not shell-command substitutions. Other transports and disabled registrations are not supported.

For other clients, merge the object from `takomi computer-use config` into their existing MCP settings. Do not replace the entire settings file. The registration points to Takomi's shared launcher and discovers that PC's Codex runtime. The other client owns its approval UI and permission storage. This command does not configure Claude, Gemini, or another client automatically.

In Pi, use `takomi_computer_use` with `action: "instructions"` first. `action: "js"` accepts `code`, optional `title`, and optional `timeout_ms`. `action: "reset"` resets the JavaScript kernel. `action: "status"` reports connection state. This is an extension-owned connection, so an existing built-in MCP connection may remain available separately. Neither client's access choices override the other's policies.

## Permissions and revocation

The dialog starts with Deny. Allow this request grants no remembered access. Session and Always choices appear only for ordinary low-risk app requests with matching server-advertised scopes. Headless runs cancel new approval requests but can reuse valid permanent grants.

To revoke all permanent grants, stop Pi and reset `~/.pi/agent/takomi/computer-use-approvals.json` to:

```json
{"version":1,"apps":[]}
```

Remove one `apps` entry to revoke a single app/server grant. Server identities are hashes of the selected registration. A changed command, arguments, working directory, or configured environment requires new consent. The old prototype's `mcp-app-approvals.json` is separate and is not imported.

`takomi computer-use disable` preserves grants and files but disables the feature after Pi restarts. This does not disable an existing built-in MCP registration or another client's connection.

## Troubleshooting

- Missing CLI or guidance files, open/update Codex and make sure its desktop plugin is enabled. Use `--codex-cli` for an executable or `codex.js` entry script if PATH discovery fails.
- `Computer Use native pipe is unavailable`, reopen Codex and rerun the read-only doctor. A valid MCP registration alone does not establish a live connection to the app. Setup remains disabled until inventory succeeds.
- Failed window activation, refresh window discovery once. If it still fails, ask the user to bring the target app forward. Do not retry typing blindly.
- Unsupported approval forms, this extension declines URL forms and data-entry forms. It does not collect passwords or silently approve them.
- No new approval in a headless run, use a Pi TUI or a dialog-capable RPC host. RPC hosts must support Pi's `extension_ui_request` and `extension_ui_response` messages.

## User flow

- `takomi setup computer-use` offers a compatible existing stdio MCP or a new shared Codex desktop launcher.
- Computer use appears in the optional Pi feature selector, unselected by default.
- `takomi computer-use doctor` checks the configured server with an MCP handshake and a read-only desktop inventory call. It does not send desktop input or grant app access.
- Pi exposes `takomi_computer_use`, with JavaScript execution, kernel reset, and instructions/status operations. It owns its MCP connection and forwards real approval requests through Pi's existing dialogs.
- The approval dialog starts with Deny and Allow this request. Ordinary low-risk app-access requests can also offer session and permanent choices when the server advertises them.

## Components

### CLI and installer

`src/computer-use/` contains setup, status/doctor, portable Codex discovery, and a shared launcher. Setup copies the launcher to `~/.mcp/servers/takomi-computer-use/`. It resolves the user's installed Codex CLI and reads its `node_repl` registration instead of copying a runtime or embedding a username, package-manager prefix, or release hash.

The installer copies the bundled Pi extension and installs its exact-version client dependencies only after explicit opt-in. It does not run on npm postinstall. Existing MCP registrations are read for selection, not rewritten.

### Pi integration

`.pi/extensions/takomi-computer-use/` is inert unless the user-level computer-use configuration is enabled. `src/pi-harness.js` explicitly includes this extension once in source-checkout launches. MCP connections start during the session lifecycle and close during shutdown. Client dependencies load only when the feature is enabled, so the ordinary Takomi installation does not require optional dependencies.

The extension uses an MCP client with form elicitation support. It does not patch Pi's installed modules or bundles. An existing MCP server is reused through its stdio command, arguments, environment, and working directory. Pi's built-in MCP registrations remain separate; the extension's tool has a distinct name and its own connection.

The launcher sends the matching Codex computer-use guidance to clients. Browser services are excluded from the shared launcher. Codex must remain open and Windows must be unlocked. All clients share one desktop, so only one agent should send input at a time.

### Approvals

Approvals are tied to the selected server identity and app identifier. Session grants stay in memory. Permanent grants are saved only after an explicit Always choice and reused only for matching ordinary low-risk app access. Recording audio, high-risk requests, data-entry forms, URL forms, and separately identified sensitive actions are not silently approved.

A malformed approval file is preserved. Unsupported forms are declined. Cancellation before approval commits, shutdown, and stale sessions cannot create grants. File writes preserve existing grants and use locking plus atomic replacement.

## Data flow

1. Setup detects compatible existing MCP registrations and the local Codex installation.
2. The user selects a server and confirms setup.
3. Takomi installs its own launcher/extension and writes user-level feature configuration.
4. Pi reads that configuration and connects to the selected stdio MCP.
5. Tools and instructions become available through the extension-owned tool.
6. Server approval requests are displayed to the user. Only selected scopes are remembered.
7. On shutdown, Pi cancels pending work and closes the connection.

## Persistent data

There is no database. User-owned JSON files contain:

- `~/.pi/agent/takomi/computer-use.json`: enabled state and selected stdio server configuration.
- `~/.pi/agent/takomi/computer-use-approvals.json`: explicit per-server, per-app permanent approvals.

No credentials or arbitrary server environment values are printed in diagnostics. Project configuration and webpage content cannot create approval grants.

## Scope and limits

Windows is the supported platform for the initial release. The Codex runtime and app are prerequisites, not bundled artifacts. The generic launcher can be registered manually with other MCP clients, which must support approval forms themselves. This feature does not ship browser automation or a global always-approve switch.

Desktop activation failures, stale accessibility trees, and application-specific UI behavior remain runtime limitations. The feature must report them rather than claim input succeeded.

## Completion criteria

- Defaults and npm postinstall do not enable computer use.
- Existing MCP reuse and new launcher setup both work without machine-specific paths in source.
- Setup preserves existing client configuration and Codex files.
- The extension is compatible with the repository's Pi baseline and has no installed-Pi bundle patch dependency.
- Request, session, permanent, denial, and cancellation paths have focused tests.
- Tests use temporary homes and fake MCP servers; real desktop checks are read-only.
- Published npm contents include the launcher, extension, and setup documentation, with no copied Codex binaries or user approval state.

---
name: tailscale-app-serve
description: Use when a user wants to expose or test a local web app through Tailscale Serve, needs a tailnet-only HTTPS link, or asks for remote access without deploying the app.
author: Unknown
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Tailscale app serve

Serve the app over tailnet-only HTTPS. Use a production build by default; use a dev server only when the user asks for one.

## Inspect the target

1. Confirm the repository, worktree, requested app, build and start scripts, environment files, and any running server. Check for concurrent edits before building from a shared worktree.
2. Run `tailscale status --json` and `tailscale serve status --json`. Derive the current machine's tailnet DNS name from the status output. Inspect Funnel status separately.
3. Choose a free local port and HTTPS port. Check listeners **and** existing Serve routes: a route's local port remains reserved even when its app is offline. Preserve every unrelated route.

Finish this step with the exact app, local port, HTTPS port, origin, and existing routes identified. Never infer ports or hostnames from another repository.

## Authorize changes

Treat these as separate changes: adding a Serve route, editing local origins, editing hosted backend settings, changing OAuth provider callbacks, and sending test email or payments. Get approval for each change not already covered by the request. Confirm the target before any database migration or deployment. Tailscale access alone authorizes neither.

Use Serve for tailnet access. Keep Funnel off unless the user explicitly approves public internet exposure. Keep credentials out of logs and replies; inspect only the environment variables needed for origins.

## Prepare the app

1. Inspect the build script before running it. If it deploys migrations or mutates data, separate those steps or stop for approval. Run the repository's build and focused checks for the requested app, using its package manager and scripts.
2. For authenticated apps, set the browser-facing URL, server auth URL, and exact trusted origins to the chosen `https://<tailnet-dns-name>:<https-port>`. Preserve any localhost origins the user still needs. Identify external OAuth callback allowlists, verification links, and payment return URLs that require separate changes.
3. Rebuild after changing build-time public environment variables. Check inherited process variables as well as env files: inherited values can override a newly edited file. Verify the compiled client uses the chosen tailnet origin.
4. Keep an existing production server available during editing and building when possible. Once the build passes, prepare a production server bound to `127.0.0.1:<local-port>`. For access after the agent session ends, use a persistent local process and ignored local logs; keep its process ID for checks.

Finish this step only when the build succeeds and the browser bundle and server environment agree on the origin. A successful build alone does not replace a running server's build.

## Publish and activate

Configure only the chosen port:

```sh
tailscale serve --bg --https=<https-port> http://127.0.0.1:<local-port>
```

Start or restart only the requested app after the build. Do not replace an unrelated process or Serve route. If the CLI syntax differs, check `tailscale serve --help` before changing its configuration.

## Verify and hand off

- Confirm the server process stays up and the smoke route responds on both `127.0.0.1:<local-port>` and the HTTPS tailnet URL.
- Confirm `tailscale serve status --json` maps the chosen HTTPS port to that local port. Check that prior routes remain and Funnel is off.
- If the app has an auth session endpoint, request it through the tailnet URL. A successful anonymous response proves routing, **not** sign-in. Ask the user to test sign-in and any external callback from a tailnet-connected device before claiming those flows work.
- Tell the user to keep the host awake and connected to Tailscale during remote testing.

Put a clickable link to the useful route near the top of the handoff. Report the build and route checks, the live server process, untested callbacks, and any changes that still need approval. State explicitly whether you left deployments, pushes, hosted backend settings, and Funnel untouched.

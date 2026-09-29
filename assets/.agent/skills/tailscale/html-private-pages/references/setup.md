# Set up private HTML pages

Use this only when the current machine does not already have a working AgentPages route. Do not assume another machine shares this one's hostname, paths, or ports.

1. Check the OS, `tailscale version`, `tailscale status --json`, and `tailscale serve status --json`. Confirm the node is logged in, find its `Self.DNSName`, and choose an unused HTTPS port. Preserve existing Serve routes. Keep Funnel off.
2. Create one `AgentPages` directory in the user's home folder, with a subfolder per project. Keep server code outside that directory. Choose an unused local port if a proxy is needed.
3. Prefer Tailscale's built-in directory serving: `tailscale serve --bg --https=<https-port> <absolute-pages-directory>`. Test whether it serves an `.html` file as `text/html`. On Windows this may require a local administrator. If permission is unavailable, use the bundled [static server](../scripts/serve.mjs) instead. It requires Node.js, uses only built-in modules, binds to `127.0.0.1`, and serves only the directory passed to it:

   ```text
   node <absolute-path-to-serve.mjs> <absolute-pages-directory> <local-port>
   tailscale serve --bg --https=<https-port> http://127.0.0.1:<local-port>
   ```

4. For the proxy option, arrange for the Node server to start after sign-in. On Windows, place a `.vbs` launcher in the user's Startup folder to run Node with window style `0` (hidden). Generate it using the actual absolute Node, script, and pages paths; don't copy paths from another PC:

   ```vbscript
   Set shell = CreateObject("WScript.Shell")
   shell.Run """<node.exe>"" ""<serve.mjs>"" ""<AgentPages>"" <local-port>", 0, False
   ```

   Test the launcher and confirm it leaves a process listening only on localhost. On other systems, use the machine's existing user startup mechanism for the same Node command. The Serve `--bg` route persists independently of the Node process. Do not use a visible console window as the Startup launcher.
5. Write a sample file at `AgentPages/setup-check/sample.html`. Request `https://<Self.DNSName>:<https-port>/setup-check/sample.html`. Confirm HTTP 200, `Content-Type: text/html`, and the expected page body. This verifies local access through the tailnet URL; ask the user to check a second device on Tailscale. New files should be available without restarting either service.

Record the chosen paths, ports, start and stop steps, and sample link locally for future agents. To stop the proxy, stop only its Node process. To disable its Tailscale listener, use `tailscale serve --https=<https-port> off`. Never use `tailscale serve reset`, which would remove unrelated routes. The host must be awake and online for links to work.

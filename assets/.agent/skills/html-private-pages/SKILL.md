---
name: html-private-pages
description: Use when creating a private HTML plan, report, or explanation that should be opened from another device on the user's Tailscale network.
author: J StaR Films / Takomi
version: 1.0.0
---

# Private HTML pages

Save generated pages in the shared `AgentPages` directory under the user's home folder. Create a project subfolder for each project, for example `AgentPages/project-name/`. Keep pages self-contained with embedded CSS and JavaScript where practical, and make the layout work on phones.

## File names

Use a short, descriptive project folder and HTML filename with lowercase ASCII letters, digits, and hyphens. Replace spaces and punctuation with hyphens. Add a date or short unique suffix when a name already exists. Keep the `.html` extension and do not overwrite an existing page unless asked.

## URL and verification

Use the configured Tailscale HTTPS hostname and port from the local workflow documentation. Construct the URL as `https://<tailscale-hostname>:<port>/<project-folder>/<file-name>.html`, URL-encoding path segments if needed. Never use localhost, a local filesystem path, Funnel, or a public hosting URL.

After saving, request the URL over HTTPS and check for a successful response with `Content-Type: text/html`, then confirm the response contains the expected page content. A local request confirms the service can return the page; it does not confirm access from another device. Do not claim cross-device verification unless a connected device actually opens the link.

Return the URL as a clickable Markdown link, for example `[View the project report](https://<tailscale-hostname>:<port>/<project-folder>/<file-name>.html)`. Mention if the host must be awake and online and the viewing device must be connected to Tailscale.

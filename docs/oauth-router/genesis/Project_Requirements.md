# Project Requirements Document

## Project Overview

**Name:** Pi OAuth Router
**Mission:** Add an auto-loaded Pi provider that load-balances requests across multiple OAuth-authenticated accounts for OpenAI-compatible upstreams without a separate router process.
**Tech Stack:** Pi Extensions, TypeScript, Node.js built-ins, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`

## Functional Requirements

| FR ID | Description | User Story | Status |
| :--- | :--- | :--- | :--- |
| FR-001 | Register a custom `oauth-router` provider with usable model entries and normal Pi model selection behavior. | As a Pi user, I want to select `oauth-router/<model>`, so that Pi routes requests automatically across configured accounts. | MUS |
| FR-002 | Provide extension-owned multi-account login, listing, removal, refresh, enable/disable, and policy commands. | As a Pi user, I want to manage multiple OAuth identities inside one extension, so that I can operate more than one account for the same upstream. | MUS |
| FR-003 | Persist multiple OAuth credentials in an extension-specific secret store with per-account separation and expiry metadata. | As a Pi user, I want my router accounts to persist across restarts, so that I do not need to log in again every time Pi starts. | MUS |
| FR-004 | Implement routing policies with cooldowns, penalties, disabled-account skipping, and unhealthy-account avoidance. | As a Pi user, I want the router to prefer healthy accounts automatically, so that temporary rate limits or failures do not stop my workflow. | MUS |
| FR-005 | Retry another account only when safe before meaningful output is emitted. | As a Pi user, I want automatic failover when it is still correct to retry, so that I get better reliability without corrupted partial responses. | MUS |
| FR-006 | Reuse or adapt Pi’s existing OAuth implementation where possible and clearly document what cannot be reused for multi-account routing. | As a Pi extension author, I want to leverage Pi’s built-in OAuth primitives safely, so that I minimize duplicated auth logic while still supporting multiple accounts. | MUS |
| FR-007 | Expose router observability for per-account health, cooldowns, last use, failures, and auth state. | As a Pi user, I want to inspect router status quickly, so that I understand why a given account is or is not being used. | MUS |
| FR-008 | Extend the router with more upstream-specific OAuth adapters and richer UI indicators. | As a Pi power user, I want pluggable upstream adapters and inline UI signals, so that I can route more providers with less manual config. | Future |

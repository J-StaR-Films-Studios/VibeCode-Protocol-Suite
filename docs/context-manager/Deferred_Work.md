# Takomi Context Manager Deferred Work

This file tracks follow-up ideas that were intentionally deferred after the current context-manager build.

## 1. Semantic / RAG Skill Matching

Current routing is heuristic. It uses skill names and descriptions for lightweight matching.

Future work:

- Add embedding-based or semantic retrieval.
- Rank skills by meaning, not only string overlap.
- Keep output as candidate hints, not full context dumps.

## 2. Conversation-Aware Skill Routing

Current candidate routing mostly uses the current user prompt.

Future work:

- Include recent conversation summary.
- Include active Takomi stage/task state.
- Avoid losing context when the user says short follow-ups like "yeah do that".

## 3. Project Signal Routing

Future work:

- Detect frameworks from project files, e.g. `package.json`, `next.config`, `convex/`, `app/`, etc.
- Surface relevant skills from project signals.
- Example: Next.js project automatically raises `nextjs-standards` as a likely candidate.

## 4. Context Pack Caching

Future work:

- Cache loaded skill manifests, skill packs, and policy packs per turn/session.
- Invalidate cache on `/reload`.
- Show cache hits in `context_report`.

## 5. Interactive Context UI

Future work:

- Add UI to inspect candidates.
- Allow user to pin/suppress skills or policies.
- Add commands for loading, hiding, or previewing context packs.

## 6. Automatic Duplicate Extension Dedupe

Current behavior only diagnoses known duplicate global/project Takomi extensions.

Future work:

- Auto-dedupe if Pi exposes safe hooks.
- Prefer project-local extension in dev mode.
- Warn before tool registration conflicts break subagent dispatch.

## 7. More Robust Prompt Section Parsing

Current prompt rewriting relies on known prompt sections and regexes.

Future work:

- Use structured system prompt options wherever possible.
- Reduce regex reliance.
- Prefer Pi-level prompt builder APIs if exposed later.

## 8. Full Test Automation

Current verification is mostly manual plus smoke checks.

Future work:

- Script tests for skill index/manifest/load.
- Script tests for policy gate behavior.
- Script prompt-size regression checks.
- Add CI-friendly checks if possible.

## 9. Broader Optional Policy Gates

Current enforced gate is focused on `takomi_subagent` and model-routing context.

Future work:

- Add configurable opt-in gates for other sensitive tools/actions.
- Keep all gates user-configurable.
- Avoid global behavior changes unless explicitly enabled.

## 10. Packaging / Release Automation

Future work:

- Add prepublish checks.
- Automatically run npm dry-run and package inclusion checks.
- Validate that local state files are excluded.
- Validate that all bundled `.pi/extensions/*` install automatically.

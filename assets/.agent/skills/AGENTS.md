# Engineering Instructions

## Scope

* Follow repository-specific `AGENTS.md` files and established project conventions; more specific instructions override this file.
* When writing any text that the user will read in chat or in Uis and documents always use the unslop skill when available.
* Produce merge-ready code with the smallest clear change that fully solves the request.
* Preserve unrelated user work and treat explicit constraints as hard requirements.

## Scope and Review Discipline

* The user's requested outcome is the hard scope boundary.
* Discovering another issue does not authorize fixing it. Report out-of-scope findings instead of changing them.
* Review comments are recommendations, not automatic tasks. Act only on confirmed regressions, correctness or security defects, or explicit requirement violations.
* Defer stylistic suggestions, speculative edge cases, new abstractions, unrelated cleanup, and future-proofing.
* One implementation pass and one focused review pass is the default. Do not recursively review and fix until no criticism remains.
* Done means the requested behavior works, relevant checks pass, and no confirmed blocking regression remains.
* Documentation, orchestration, and testing requirements do not expand implementation scope.

## Orchestration

* Use Takomi for broad, multi-stage work that benefits from planning, delegation, or durable tracking. Skip it for simple or localized tasks.
* Ask before using it only when it adds meaningful overhead or changes scope, cost, permissions, or external effects.

## Before Changing Code

* Read the relevant code, types, tests, configuration, and documentation first.
* Understand the existing architecture, follow established patterns, and confirm the root cause before implementing a fix.
* Do not expand the task into unrelated cleanup, redesign, or refactoring.
* Create or update a feature document only when the user requested a substantial feature or the approved change alters architecture, persistent data flow, or database schema. Touching several files alone does not make a task substantial. Documentation does not authorize additional implementation. For qualifying work, read `docs/features/` and `docs/project\_requirements.md`, then create or update `docs/features/\[FeatureName].md` with the goal, client/server components, data flow, and database schema.
* Wait for approval only when the plan involves significant design choices, expanded scope, meaningful risk, external effects, or irreversible actions.
* If those documentation paths do not exist, follow the repository's existing documentation structure. If none exists and a design document is needed, ask where it should live.

## Implementation

* Make the narrowest correct diff. Prefer modifying existing code over adding layers, helpers, wrappers, or abstractions.
* Avoid speculative flexibility, premature generalization, defensive code for impossible states, and unrequested future-proofing.
* Reuse existing utilities and dependencies before introducing new ones.
* Delete obsolete code created or exposed by the change, and preserve backward compatibility unless a breaking change is explicitly required.
* Comments should explain non-obvious reasoning, not restate the code.
* Treat roughly 200 lines as a cohesion review signal, not a hard limit. Split files only when they contain multiple responsibilities or extraction clearly improves maintainability.

## TypeScript

* Write idiomatic TypeScript, not Python translated into TypeScript.
* Do not use `any`, `as any`, broad casts, or unnecessary non-null assertions. Prefer precise types or `unknown` with proper narrowing.
* Avoid tiny wrapper functions whose only purpose is casting, forwarding, or renaming.
* Prefer direct control flow, preserve useful inference, and add explicit types where they improve safety or define a public API.
* Follow the repository's conventions for modules, async code, errors, validation, naming, and dependencies.

## Frontend

* Follow the existing design system and component patterns; do not invent a new visual language unless explicitly asked.
* Avoid unnecessary cards, oversized typography, excessive spacing, decorative gradients, and UI clutter.
* Preserve responsive and mobile behavior. For new design work, establish information hierarchy and interaction before decoration.

## Tests, Documentation, and Verification

* Keep testing proportional to the change. Add or update only focused tests for changed behavior, important regressions, and meaningful edge cases.
* Do not add redundant smoke tests, snapshot churn, trivial tests, or tests that duplicate TypeScript checks. Do not rewrite unrelated tests or change a valid test to excuse an incorrect implementation.
* Update documentation when behavior, architecture, setup, configuration, interfaces, data models, deployment, or documented assumptions change.
* Run the narrowest relevant checks first and broader checks only when justified. Never claim a check passed unless it was actually run successfully.

## Safety

* Never run destructive commands or alter production data, infrastructure, credentials, migrations, deployments, or external systems without explicit authorization and a confirmed target.
* For Convex projects, run local validation. Run `pnpm convex deploy` only when the user explicitly authorizes deployment and the target environment is confirmed.
* Verify the exact target before deleting, moving, overwriting, or mutating resources. Stop and explain when ambiguity or missing access could cause damage.
* Before intentionally creating, modifying, moving, or deleting files outside the working directory, state the exact paths and purpose and obtain permission. Tool-managed temporary or cache files are exempt unless they create meaningful risk.
* On Windows, avoid oversized one-shot commands or patches. Prefer repository-relative paths, smaller patches, or temporary scripts.

## Final Simplification Pass

Before finishing, ask: "What can I delete here and still be correct?" Remove it.

Review the diff for unrelated changes, unnecessary abstractions, fallbacks, casts, dependencies, tests, or documentation. Ensure the result is idiomatic, strongly typed, and easy to merge.

## Completion Report

Keep the final response brief. State what changed, the important implementation decision, which checks were run and their results, and any real limitation or unresolved risk.

# Context

Takomi publicly promises that `takomi_subagent` can launch in an explicit absolute directory outside the parent workspace, but the production adapter revalidates the already-approved path and rejects it as a workspace escape. This makes orchestrators inherit or use the wrong project cwd even though native `pi-subagents@0.31.0` already supports external absolute directories. The change should restore the promised behavior, make the effective canonical cwd visible before launch, and strengthen model-facing guidance so a path written only in task prose is never mistaken for launch configuration.

The intended contract is: omit `cwd` for the current project; explicitly supply it whenever the intended project differs; relative values remain confined to their declared parent; an explicit absolute value may target any existing directory accessible to the Pi process. Accepted paths must exist, be directories, and be canonicalized. Project-agent trust gates remain active. No active model-routing settings or policies will be changed; the agreed routing guidance will only be saved as a non-active design draft.

## 1. Fix production external-directory resolution

- Update `.pi/extensions/takomi-subagents/pi-subagents-engine.ts`, retaining its defensive `resolveRelativeCwd` validation but aligning it with the existing public resolver in `.pi/extensions/takomi-subagents/tool-runner.ts`:
  - For an explicit absolute value, normalize it, resolve it with `fs.realpathSync`, require `fs.statSync(...).isDirectory()`, and return the canonical path without parent-workspace containment.
  - For omitted or relative values, preserve lexical containment, canonical containment, existence/type validation, and relative symlink/junction escape rejection.
  - Preserve corrective errors that tell callers to use an explicit absolute cwd for an external target.
- Let the existing mapping path carry the canonical cwd through single, parallel, chain, async, management, and worktree requests. Do not modify native `pi-subagents` or bypass its worktree/task-cwd checks.
- Keep the existing target-root profile, routing, agent discovery, and project-agent trust behavior. Do not make `defaultChildExtensions()` scan or auto-load executable extensions from an external target.
- Treat a top-level external cwd as the Takomi policy/project boundary. Document that a per-task absolute cwd changes that child’s execution directory but does not create an independent per-task Takomi profile/routing/trust scope.

## 2. Make cwd selection explicit to orchestrators

- Strengthen the registered tool contract in `.pi/extensions/takomi-subagents/index.ts` across `TaskSchema.cwd`, `SubagentParameters.cwd`, `promptSnippet`, and `promptGuidelines`:
  - Omit cwd only when the intended project is the current/default project.
  - Always supply cwd when the intended project differs.
  - Use an explicit absolute cwd outside the parent workspace; use relative cwd only inside its parent.
  - State plainly that paths in task prose never change launch cwd.
- Keep cwd optional rather than forcing redundant same-project values.
- Retain `findTaskCwdMismatch` in `tool-runner.ts` as fail-closed correction feedback when task prose clearly names another existing project and no explicit cwd was supplied; do not turn the heuristic into automatic cwd inference.

## 3. Show canonical cwd in delegation plans

- Add a required canonical `cwd: string` field to `TakomiDelegationPlanTask` in `src/pi-takomi-core/types.ts`.
- Thread that field through `PlanTaskInput` and `createTakomiDelegationPlan` in `.pi/extensions/takomi-subagents/delegation-plan.ts`.
- Render each task’s working directory in `renderTakomiDelegationPlan`, so preview/manual-gate output exposes the exact path that will be used.
- Pass the already-normalized `task.cwd` from `.pi/extensions/takomi-subagents/tool-runner.ts` when constructing the plan. Ensure structured `details.plan.tasks[*].cwd` and rendered preview text agree.
- Keep cwd in the existing launch fingerprint so changing it continues to invalidate prior manual approval.

## 4. Add regression coverage that exercises the real adapter

- Create `scripts/test-subagent-external-cwd.js`, following the transpile-and-stub-native-boundary pattern in `scripts/test-subagent-acceptance.js`. Load the real `pi-subagents-engine.ts`; stub only `loadPiSubagentsInternals()`/native execution so tests remain offline and incur no model spend.
- Cover production mapping for:
  - omitted cwd and contained relative cwd;
  - top-level external absolute cwd;
  - per-task external absolute cwd in parallel and chain modes;
  - async flag and management/worktree parameter forwarding with an external root;
  - canonical path forwarding and stable task order.
- Cover safeguards:
  - nonexistent absolute path and regular-file path rejection;
  - relative `..` traversal rejection;
  - relative symlink/Windows-junction escape rejection;
  - contained relative link acceptance;
  - explicit absolute link/junction acceptance with canonical-target forwarding;
  - platform-conditional Windows junction/path cases, skipping only link-specific cases when the host denies link creation.
- Exercise the real delegation-plan code in the regression to verify canonical cwd appears in structured and rendered previews, while same-project calls remain valid without caller-supplied cwd.
- Retain and, where useful, extend `scripts/test-subagent-project-trust.js` so external cwd support cannot bypass project-agent approval and obvious prose/cwd mismatches still block before native execution.
- Register the new script in `package.json` under `test:regressions` near the existing production lifecycle/acceptance tests.

## 5. Document the cwd contract and known boundary

- Add a normative “External working directories” section to `docs/takomi-subagents-ui-parity/native-pi-subagents-backend.md` covering inheritance, relative containment, absolute external support, canonicalization, invalid-cwd behavior, task-prose mismatch handling, plan visibility, trust gates, and the decision not to auto-load external project extensions.
- Update `docs/features/Pi_Takomi_Native_Subagent_Orchestration_Upgrade.md` so its data flow and acceptance criteria include canonical cwd and reflect the current pinned native `pi-subagents` backend rather than the obsolete JSON-dispatch/no-runtime-dependency wording.
- Document, but do not weaken security to solve in this patch, the separate detached async restart limitation: live external async launches map correctly, but cross-restart/multi-root Takomi result hydration needs a future integrity-bound provenance design. The new test should claim async mapping/launch handoff, not cross-restart hydration.

## 6. Save the proposed routing policy as a non-active draft

- Create `docs/design/Takomi_Model_Routing_Policy_Draft.md` with a prominent banner that it is advisory, non-executable, and not loaded by Takomi.
- Record the agreed model-family policy and current provider-qualified examples using exact registry names (`gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`), including:
  - Sol medium as the routine default and Sol high as the normal difficult/review escalation;
  - Astra medium as the selective premium escalation, Astra high/xhigh only for unusually costly failure, and Astra low as an experimental UI/compact-trajectory route requiring browser verification;
  - Luna for low-dollar, reversible, asynchronous, or prose-oriented work, with the caveat that it is not token/step efficient at useful SWE quality;
  - Terra omitted from the normal simplified tree, with Terra high retained only as an optional sub-$1 niche;
  - explicit orchestrator-directed escalation after poor output, distinct from provider-failure `fallbackModels`.
- Include the September 3, 2026 DeepSWE snapshot, key cost/pass/token/step comparisons, source links, confidence-interval caveats, and the warning that DeepSWE does not measure UI polish or documentation quality.
- Do not modify `C:\Users\johno\.pi\agent\settings.json`, `.pi/settings.json`, or `.pi/takomi/model-routing.md`.

## Verification

Run in this order:

1. `node scripts/test-subagent-external-cwd.js`
2. `node scripts/test-subagent-project-trust.js`
3. `npm run test:typecheck`
4. `npm run test:regressions`
5. `npm test`

Finally inspect the diff and repository status to confirm:

- no files under `node_modules/pi-subagents` changed;
- no global or active project model-routing configuration changed;
- external target extensions are not auto-discovered merely from cwd;
- all accepted cwd values shown in previews match the canonical values forwarded to native execution;
- tests remain offline and perform no provider/model calls.

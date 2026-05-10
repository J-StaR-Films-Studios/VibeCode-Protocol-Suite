# Model Policy Gate Testing

## What It Does

`takomi-context-manager` now adds a model/provider gate around `takomi_subagent`.

It uses Takomi's real routing source of truth:

- `.pi/settings.json -> takomi.modelRoutingPolicyFile`
- usually `.pi/takomi/model-routing.md`, created by `/takomi routing`
- `.pi/settings.json -> subagents.agentOverrides`, also updated by `/takomi routing`

## Behaviors

### Safe auto-correction

If the agent requests the right model family with the wrong provider, the gate mutates the tool input.

Example:

```txt
openai-codex/gpt-5.5 -> oauth-router/gpt-5.5
```

The user gets a warning notification telling them what was corrected.

### Policy violation recovery prompt

If the agent requests a model/provider outside the routing policy and no obvious equivalent exists, the gate pauses with a user selection prompt. The user can choose a policy-approved model to mutate the tool call and continue, or stop and let the agent/user send a new prompt.

### Failure recovery / human pause

If `takomi_subagent` executes but fails with a provider/model-related error, the gate inspects the failure and asks the user what to do:

- retry with a policy-approved model
- stop and let the user send a new prompt

The tool result is patched with the selected guidance so the agent can respond correctly.

## How To Test

Run Pi dev:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\pi-dev.ps1
```

### 1. Confirm policy source

Ask:

```txt
call policy_manifest for model-routing
```

Expected:

- location points to `.pi/takomi/model-routing.md`

### 2. Confirm first subagent policy gate

Ask the agent to call `takomi_subagent` before loading model-routing.

Expected:

- first attempt is blocked
- response includes model-routing policy content
- policy is marked loaded
- agent is told to retry the original subagent call

### 3. Confirm wrong provider auto-correction

Ask the agent to call `takomi_subagent` with a wrong-provider equivalent, e.g.:

```txt
use takomi_subagent with model openai-codex/gpt-5.5 for a tiny test task
```

Expected:

- harness corrects to `oauth-router/gpt-5.5` if that model is approved by `/takomi routing`
- warning notification explains correction

### 4. Confirm policy violation recovery prompt

Ask the agent to use a nonsense model:

```txt
use takomi_subagent with model random-provider/not-real for a tiny test task
```

Expected:

- UI asks whether to retry with an approved model or stop
- if you choose a retry model, the tool call is corrected and continues
- if you choose stop, the call is blocked, the agent turn is aborted, and Pi waits for your next prompt

### 5. Confirm failure pause

Cause or simulate a provider/model failure.

Expected:

- UI asks whether to retry with an approved model or stop
- choosing retry gives the agent retry guidance
- choosing stop aborts the active agent turn and waits for your next prompt

# Takomi Model Routing Heuristics

> [!IMPORTANT]
> **FINAL ADVISORY POLICY — NOT ACTIVE CONFIGURATION.** This document defines the recommended routing heuristics for Takomi orchestration, but it is not executable and is not automatically loaded by Takomi. It does not modify `.pi/settings.json`, user settings, persona defaults, or `.pi/takomi/model-routing.md`. Activating it requires a separate explicit configuration change.

## Status

- **Policy status:** final advisory guidance
- **Evidence snapshot:** September 3, 2026
- **Scope:** OpenAI Codex Astra, Sol, Luna, and Terra model families
- **Runtime effect:** none

## Core principle

**Sol runs the system. Astra is called when the system needs something exceptional. Luna handles low-dollar, reversible utility work. Terra is normally skipped.**

Choose the least expensive route likely to produce acceptable work. Treat dollar cost, latency, output tokens, agent steps, and failure risk as separate considerations rather than assuming that the cheapest model is also the fastest or most token-efficient.

Do not escalate merely because a task sounds impressive. Escalate when task risk justifies it or when inspected output shows that the current route is inadequate.

## Exact model IDs and supported effort levels

Use exact provider-qualified model IDs:

| Family | Model ID |
| --- | --- |
| Astra | `openai-codex/gpt-6-astra` |
| Sol | `openai-codex/gpt-5.6-sol` |
| Luna | `openai-codex/gpt-5.6-luna` |
| Terra | `openai-codex/gpt-5.6-terra` |

Takomi currently recognizes these reasoning levels:

- `off`
- `minimal`
- `low`
- `medium`
- `high`
- `xhigh`

`max` is intentionally excluded from this policy because it is not currently accepted by Takomi's public reasoning-level contract.

Pass the model and reasoning effort separately:

```json
{ "model": "openai-codex/gpt-5.6-sol", "thinking": "medium" }
{ "model": "openai-codex/gpt-5.6-sol", "thinking": "high" }
{ "model": "openai-codex/gpt-6-astra", "thinking": "low" }
{ "model": "openai-codex/gpt-6-astra", "thinking": "medium" }
{ "model": "openai-codex/gpt-6-astra", "thinking": "xhigh" }
{ "model": "openai-codex/gpt-5.6-luna", "thinking": "medium" }
```

A provider-qualified selection is atomic. Do not silently replace an `openai-codex/...` route with a similarly named model from another provider.

# Default routing

## GPT-5.6 Sol — main workhorse

Use Sol for most implementation, reasoning, review, and orchestration work.

### Sol Low — straightforward, easily verified work

Use `openai-codex/gpt-5.6-sol` with `thinking: "low"` for:

- simple implementation with clear requirements
- straightforward bug fixes
- small code changes
- bounded repository chores
- inexpensive general-purpose agent work
- changes with cheap, deterministic verification

Sol Low is preferred over adding Terra to the normal routing tree. This is an operational policy choice rather than a conclusion established by the September 3 DeepSWE snapshot, which did not include a Sol Low row.

Do not use Sol Low as the default for architecture, security-sensitive changes, ambiguous debugging, consequential review, or work with expensive failure.

### Sol Medium — routine default

Use `openai-codex/gpt-5.6-sol` with `thinking: "medium"` for:

- default implementation
- normal-to-complex coding
- feature development
- refactors
- repository exploration and synthesis
- ordinary debugging
- most agentic work
- default orchestration when the task is not unusually difficult

Sol Medium is the standard starting route for serious work requiring judgment.

### Sol High — difficult work and important review

Use `openai-codex/gpt-5.6-sol` with `thinking: "high"` for:

- difficult implementation
- architecture and system-design decisions
- complex debugging
- cross-file work with meaningful ambiguity
- security-sensitive reasoning
- regression analysis
- important or independent review
- high-quality orchestration
- tasks where mistakes would be expensive
- recovery after materially weak Sol Medium output

Sol High is the normal quality escalation. Do not jump to Astra merely because a task is long or labeled “hard.”

## GPT-6 Astra — specialist and heavy artillery

Astra is a premium route. Use it when the expected improvement justifies its higher dollar cost.

Do not claim that Astra is inherently more token-heavy or step-heavy than Sol. In the September 3 DeepSWE snapshot, Astra Low and Medium used fewer output tokens and fewer agent steps than several comparable Sol routes. Astra may still produce solutions that are more elaborate than necessary in ordinary product work, so route it selectively and verify the actual result.

### Astra Low — UI and creative-interface specialist

Use `openai-codex/gpt-6-astra` with `thinking: "low"` primarily for:

- UI and frontend implementation
- visual implementation
- highly creative interface work
- compact-trajectory interface experiments

Astra Low is the preferred Astra mode for normal UI tasks, but this is an operational heuristic—not a conclusion established by DeepSWE.

**Browser verification is mandatory.** Verify:

- visual fidelity and polish
- interaction behavior
- responsive layouts
- loading, empty, success, and error states
- accessibility basics
- regressions in existing flows

If browser verification is unavailable, do not consider an Astra Low UI result validated.

### Astra Medium — selective premium escalation

Use `openai-codex/gpt-6-astra` with `thinking: "medium"` for:

- exceptionally difficult review
- unusually difficult orchestration
- ambitious architecture or design problems
- implementation that exceeds what Sol High is comfortably handling
- high-risk work where a premium initial route is justified
- deliberate escalation after inadequate Sol High output

Astra Medium is selective, not a routine default.

### Astra High or xHigh — exceptional use

Use `openai-codex/gpt-6-astra` with `thinking: "high"` or `thinking: "xhigh"` only when:

- the task is genuinely extreme
- Sol High or Astra Medium has failed after inspection
- ambiguity remains severe
- correctness matters substantially more than cost or speed
- failure would be unusually costly
- a premium final pass is justified by the risk

Do not use Astra High or xHigh merely because a task is “hard.” The displayed DeepSWE uncertainty bands for Astra Medium, High, and xHigh overlap strongly; that snapshot does not establish a dependable routine gain from paying for the higher efforts.

## GPT-5.6 Luna — low-dollar utility model

Use Luna for inexpensive work that is easy to inspect, reverse, repeat, or redo.

Good Luna tasks include:

- documentation drafts
- summaries and extraction
- bounded file inspection
- formatting and cleanup
- mechanical edits
- repetitive transformations
- asynchronous background chores
- low-risk parallel tasks
- disposable experiments
- tightly scoped work with explicit acceptance criteria

Use the lowest Luna effort that remains reviewable, usually Low or Medium for small utility tasks. Consequential Luna output requires review.

Luna is cheap in dollar terms, but it is **not assumed to be fast, token-efficient, step-efficient, or dependable for serious coding**. At useful SWE quality, its trajectories can become substantially longer than Sol or Astra trajectories. Move coding work to Sol rather than driving Luna to extreme effort by default.

## GPT-5.6 Terra — normally omitted

Terra is excluded from the normal simplified routing tree.

`openai-codex/gpt-5.6-terra` with `thinking: "high"` may be considered only when:

- a sub-$1 average benchmark-cost target is a hard constraint
- requirements are exceptionally clear
- the task is bounded and reviewable
- its lower expected SWE quality is acceptable

Do not treat Terra High as the default serious coder. Sol Low is the preferred low-effort Sol route, while Luna covers low-dollar utility work.

# Routing by task lane

Do not force all work through one universal linear ladder. Route according to task type.

## Documentation, mechanical, and reversible utility work

```text
Luna Low or Medium
→ inspect the result
→ Sol Medium if quality or reasoning is inadequate
```

## Straightforward code

```text
Sol Low
→ Sol Medium if ambiguity or failure appears
→ Sol High if the problem is genuinely difficult
```

## Routine serious implementation

```text
Sol Medium
→ Sol High after inspected weakness or rising risk
```

## Difficult implementation, architecture, debugging, or review

```text
Sol High
→ Astra Medium when premium escalation is justified
→ Astra High/xHigh only for exceptional unresolved risk
```

## UI and creative-interface implementation

```text
Astra Low
→ mandatory browser verification
→ revise with Astra Low or Sol Medium/High based on the failure
→ Astra Medium only if the problem is unusually ambitious or difficult
```

## Hard sub-$1 coding constraint

```text
Terra High may be considered
→ mandatory review and deterministic verification
```

# Default role routing

These are defaults, not hard restrictions. The orchestrator may override them when task evidence justifies another route.

| Role or task | Default route | Escalation |
| --- | --- | --- |
| Orchestrator | Sol Medium | Sol High; Astra Medium only for unusually difficult orchestration |
| Architect | Sol High | Astra Medium for ambitious or unresolved architecture |
| Coder | Sol Medium | Sol Low for simple code; Sol High for difficult implementation |
| Reviewer | Sol High | Astra Medium for exceptionally difficult or high-risk review |
| Designer — UI implementation | Astra Low | Astra Medium only for unusually ambitious UI work |
| Designer — non-UI planning | Sol Medium | Sol High for complex product/system design |
| Worker — code chore | Sol Low | Sol Medium |
| Worker — prose/mechanical chore | Luna Low or Medium | Sol Medium |
| Summarization/documentation | Luna Low or Medium | Sol Medium when reasoning quality matters |

# Escalation rules

Escalate only when at least one of these is true:

1. Inspected output shows that the current model is clearly struggling.
2. The task's ambiguity or technical complexity genuinely warrants a stronger route.
3. The cost of failure is high enough to justify premium work from the beginning.
4. Independent review identifies unresolved correctness, security, or architecture risk.

Before escalating after failure:

1. Inspect what failed.
2. Correct missing context, cwd, requirements, tools, or acceptance criteria first.
3. Decide whether the problem was model capability or bad task construction.
4. Select the next route explicitly.
5. Re-run the relevant verification after the stronger model completes.

Do not use model escalation to hide orchestration mistakes.

# Quality escalation is not `fallbackModels`

These mechanisms solve different problems.

## Quality escalation

Quality escalation is an orchestrator decision based on task risk, ambiguity, review findings, or observed output quality.

```text
Sol Medium output is inadequate
→ inspect the failure
→ correct task/context issues
→ retry or continue with Sol High
→ use Astra Medium only when premium escalation is justified
```

The next delegation plan should explicitly state the new model and effort.

## `fallbackModels`

`fallbackModels` handles provider or runtime failure—for example, quota, authentication, timeout, or model unavailability. It is not a quality ladder.

A successful but weak result returns to the orchestrator for review and deliberate redispatch. It must not silently consume a more expensive fallback merely because its quality was poor.

Every fallback must remain exact and provider-qualified. Provider switching is authorized only when the caller explicitly lists that fallback.

# Anti-patterns

Do not:

- use Astra solely because a task sounds impressive
- describe Astra as universally slower or more token-heavy than Sol
- call Luna token-efficient merely because it is dollar-cheap
- use Luna at extreme effort for serious coding when Sol is the appropriate lane
- route all tasks through Luna before Sol
- treat Terra as the standard budget coder
- use unsupported `max` effort in Takomi routing
- use `fallbackModels` as an automatic quality escalator
- escalate before checking cwd, context, instructions, tools, and acceptance criteria
- accept UI output without browser verification
- silently substitute a different provider's similarly named model

# DeepSWE evidence snapshot — September 3, 2026

The following values were transcribed from the official DeepSWE v1.1 leaderboard's **All effort levels** view. The leaderboard covered 113 tasks across 91 repositories and five languages, with the listed models run through `mini-swe-agent`.

| Model configuration | Pass@1 | Average cost | Output tokens | Agent steps |
| --- | ---: | ---: | ---: | ---: |
| `gpt-6-astra[low]` | 67% ±1% | $2.19 | 11k | 20 |
| `gpt-6-astra[medium]` | 73% ±3% | $4.38 | 20k | 26 |
| `gpt-6-astra[high]` | 73% ±3% | $5.72 | 27k | 27 |
| `gpt-6-astra[xhigh]` | 74% ±3% | $6.52 | 30k | 29 |
| `gpt-5.6-sol[medium]` | 61% ±2% | $1.42 | 18k | 31 |
| `gpt-5.6-sol[high]` | 69% ±1% | $2.66 | 28k | 37 |
| `gpt-5.6-sol[max]` | 73% ±3% | $6.46 | 60k | 61 |
| `gpt-5.6-luna[low]` | 2% ±1% | $0.01 | 3.1k | 12 |
| `gpt-5.6-luna[medium]` | 11% ±1% | $0.04 | 8.2k | 24 |
| `gpt-5.6-luna[high]` | 44% ±3% | $0.16 | 26k | 49 |
| `gpt-5.6-luna[xhigh]` | 57% ±2% | $0.31 | 45k | 71 |
| `gpt-5.6-luna[max]` | 67% ±4% | $0.61 | 73k | 102 |
| `gpt-5.6-terra[high]` | 54% ±4% | $0.91 | 22k | 34 |

## Evidence interpretation

- Sol High improves materially over Sol Medium in the displayed snapshot, supporting it as the normal difficult-work and review escalation.
- Astra Medium has a higher average dollar cost than Sol High, but used fewer displayed output tokens and steps while scoring higher.
- Astra High and xHigh cost more than Astra Medium without a clearly established routine gain because their displayed uncertainty bands overlap.
- Astra Low's compact trajectory supports experimentation, but DeepSWE does not measure UI quality.
- Luna's advantage is low dollar cost, not token or step efficiency at serious SWE quality.
- Terra High retains a possible sub-$1 niche but does not justify inclusion in the normal routing tree.
- Sol Low is an operational recommendation in this policy; the cited snapshot did not provide a Sol Low row.

## Evidence caveats

- DeepSWE measures original long-horizon SWE tasks under one shared harness. It is not a universal ranking of model quality.
- It does not directly measure provider-native Codex behavior, UI polish, visual fidelity, browser interaction, documentation quality, or orchestration quality.
- Displayed confidence intervals overlap for several nearby routes and should not be treated as statistically decisive without methodology details.
- Public values are rounded and pricing-sensitive.
- A benchmark result measures the model, reasoning effort, harness, task distribution, verifier, and pricing snapshot together.
- Repository-specific evaluations and actual acceptance checks take precedence over the general leaderboard.

# Sources

- [DeepSWE v1.1 leaderboard](https://deepswe.datacurve.ai/)
- [DeepSWE v1.1 data explorer](https://deepswe.datacurve.ai/data/v1.1)
- [DeepSWE methodology and limitations](https://deepswe.datacurve.ai/blog/deepswe)
- [DeepSWE changelog](https://deepswe.datacurve.ai/changelog)
- [DeepSWE source repository](https://github.com/datacurve-ai/deep-swe)
- [`mini-swe-agent` evaluation harness](https://github.com/SWE-agent/mini-swe-agent)

# Adoption boundary

This policy remains advisory until separately activated. Adoption requires an explicit change to the appropriate structured settings or active routing-policy file, followed by provider-registry validation and normal Takomi review gates.

# Code Context

## Files Retrieved
1. `package.json` (lines 1-45) - published package only includes `bin`, `src`, and `assets`; `.pi` is not shipped.
2. `src/utils.js` (lines 24-70) - current installer copies only legacy `assets/.agent`, `Takomi-Agents`, and `Legacy`, not Pi-native assets.
3. `.pi/README.md` (lines 1-24, 64-76) - states intended Pi-native architecture and explicitly says Takomi should keep `takomi_subagent` while Pi owns `subagent`.
4. `.pi/extensions/takomi-subagents/index.ts` (lines 33-75) - tool registration for `takomi_subagent`.
5. `.pi/extensions/takomi-subagents/tool-runner.ts` (lines 80-209) - current wrapper semantics: single/parallel/chain, default `agentScope`, plan preview, project-agent confirmation, shared dispatch path.
6. `.pi/extensions/takomi-subagents/dispatch.ts` (lines 62-212) - actual execution path; shells out to Pi CLI JSON mode and persists conversation sessions.
7. `.pi/extensions/takomi-subagents/agents.ts` (lines 43-109) - Takomi agent discovery; hard-codes `~/.pi/agent/agents` and merges project/global agents.
8. `.pi/extensions/takomi-runtime/shared.ts` (lines 173-209) - shared Pi process invocation used by Takomi dispatch.
9. `scripts/sync-pi-global.ps1` (lines 16-135) - current manual/dev install path for Pi assets into `~/.pi`.
10. `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts` (lines 768-845) - `ExtensionAPI` can inspect tools via `getAllTools()`/`getActiveTools()`, but exposes no tool-invocation API.
11. `node_modules/@mariozechner/pi-coding-agent/package.json` (lines 14-29) - package exports only `.` and `./hooks`; subagent implementation is not a supported import target.
12. `node_modules/@mariozechner/pi-coding-agent/examples/extensions/subagent/index.ts` (lines 220-233, 265-306, 431-460) - Pi's native/example `subagent` also shells out to Pi CLI; it is an example extension, not a library API.
13. `node_modules/@mariozechner/pi-coding-agent/examples/extensions/subagent/agents.ts` (lines 7-18, 97-103) - Pi example uses `getAgentDir()` instead of hard-coded `~/.pi` paths.

## Key Code
- Takomi already registers its own wrapper tool, not `subagent`:

```ts
// .pi/extensions/takomi-subagents/index.ts:52-70
pi.registerTool({
  name: "takomi_subagent",
  description: "Run subagents with Pi-style single, parallel, or chain modes plus Takomi lifecycle metadata.",
  async execute(...) {
    return executeTakomiSubagentTool(pi, params, signal, onUpdate, ctx);
  },
});
```

- The wrapper does not call another Pi tool. It resolves tasks, builds a delegation plan, then dispatches directly:

```ts
// .pi/extensions/takomi-subagents/tool-runner.ts:113-160
const agentScope = params.agentScope ?? "both";
const plan = createTakomiDelegationPlan(...);
if (params.previewOnly || (plan.launchMode === "manual" && !params.confirmLaunch)) {
  return textResult(renderTakomiDelegationPlan(plan), ...);
}
```

- Actual execution is a spawned Pi subprocess, not a tool-to-tool call:

```ts
// .pi/extensions/takomi-subagents/dispatch.ts:148-153
const args = ["--mode", "json", "--append-system-prompt", promptPath, "--session", sessionPath, taskPrompt];
const result = await runPiAgentJson(subagentCwd, args, signal, ...);
```

```ts
// .pi/extensions/takomi-runtime/shared.ts:173-176
export function getPiInvocation(args: string[]) {
  const currentScript = process.argv[1];
  if (currentScript) return { command: process.execPath, args: [currentScript, ...args] };
  return { command: "pi", args };
}
```

- `ExtensionAPI` can detect tools, but not invoke them:

```ts
// node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts:797-845
registerTool(...): void;
getActiveTools(): string[];
getAllTools(): ToolInfo[];
setActiveTools(toolNames: string[]): void;
```

- Pi's `subagent` is only an example extension and also uses subprocess spawning:

```ts
// node_modules/@mariozechner/pi-coding-agent/examples/extensions/subagent/index.ts:431-444
pi.registerTool({ name: "subagent", ... })
```

```ts
// node_modules/@mariozechner/pi-coding-agent/examples/extensions/subagent/index.ts:265-306
const args = ["--mode", "json", "-p", "--no-session"];
const proc = spawn(invocation.command, invocation.args, ...);
```

- Packaging gap: current npm package/install path does not ship/install `.pi`:

```json
// package.json:9-13
"files": ["bin", "src", "assets"]
```

```js
// src/utils.js:24-31, 51-64
PATHS = { assets, agent, workflows, skills, agentsYaml, manual }
// copies .agent, VibeCode-Agents, Legacy-Protocols only
```

## Architecture
- Current state: `takomi_subagent` is already a Pi-aligned wrapper in behavior, but it is **not** a wrapper around Pi's `subagent` tool implementation.
- Why: Pi extension code has inspection APIs (`getAllTools`, `getActiveTools`) but no runtime `invokeTool/executeTool/callTool` API. So Takomi code can detect native `subagent`, but cannot safely call it as a tool from extension code.
- Pi native/example `subagent` is not exported as stable library API (`@mariozechner/pi-coding-agent/package.json` only exports `.` and `./hooks`). Deep-importing `examples/extensions/subagent/*` would be brittle.
- Both Takomi and Pi's example use the same real substrate: spawn a separate `pi` process in JSON mode. That means the best alignment path is shared semantics/shared helpers, not tool-to-tool invocation.

### Actionable recommendations
1. **Do not try to programmatically invoke Pi's `subagent` tool from Takomi.**
   - Use detection only for UX/docs, e.g. in `.pi/extensions/takomi-runtime/index.ts` or `.pi/extensions/takomi-subagents/index.ts`:
     - `pi.getAllTools().some(t => t.name === "subagent")`
     - `pi.getActiveTools().includes("subagent")`
   - Good uses: status text, warnings, docs, or toggling stricter compatibility behavior.

2. **Keep `takomi_subagent` as the lifecycle-aware wrapper and align its contract with Pi's native `subagent`.**
   - Main code: `.pi/extensions/takomi-subagents/tool-runner.ts`, `.pi/extensions/takomi-subagents/dispatch.ts`, `.pi/extensions/takomi-subagents/agents.ts`
   - Preserve Takomi-only additions: `conversationId`, `workflow`, `skills`, `model`, `fallbackModels`, `thinking`, `checklist`, `confirmLaunch`, `previewOnly`.

3. **Fix agent discovery to use Pi helpers, not hard-coded `~/.pi` paths.**
   - Change target: `.pi/extensions/takomi-subagents/agents.ts:91-95`
   - Pi example uses `getAgentDir()` in `node_modules/@mariozechner/pi-coding-agent/examples/extensions/subagent/agents.ts:7-18,97-103`.
   - This avoids breaking custom Pi config locations.

4. **Decide whether to intentionally keep or change the default scope mismatch.**
   - Takomi default: `agentScope ?? "both"` in `.pi/extensions/takomi-subagents/tool-runner.ts:113-117`
   - Pi example default: `agentScope ?? "user"` in `node_modules/@mariozechner/pi-coding-agent/examples/extensions/subagent/index.ts:443-447`
   - If strict compatibility matters, change Takomi default or document the difference clearly.

5. **Ship/install the Pi-native `.pi` assets before relying on this path.**
   - Current blockers:
     - `package.json:9-13` excludes `.pi`
     - `src/utils.js:24-70` installs only legacy assets
     - `scripts/sync-pi-global.ps1:16-135` is the only install path, and it is manual/dev-oriented
   - Likely files to change: `package.json`, `src/utils.js`, `src/cli.js`, possibly move Pi assets under a shipped folder (`packages/pi` or `assets/pi`) as `.pi/README.md:21-24` already suggests.

6. **Document native-subagent dependency as optional, not required for execution.**
   - `takomi_subagent` already works by spawning `pi`; it does not require Pi's example `subagent` extension.
   - What is worth documenting: if a user also has Pi's `subagent` installed, Takomi intentionally does **not** claim the `subagent` name (`.pi/README.md:68-76`).

### Risks / open questions
- `scripts/sync-pi-global.ps1:94-99` links the entire `~/.pi/agent/agents` destination to repo `.pi/agents`; that can overwrite an existing user agent directory instead of merging.
- Deep-importing `node_modules/.../examples/extensions/subagent/*` would couple Takomi to a non-exported example path.
- Current package publish/install story does not match the Pi-native runtime story yet.

## Start Here
Open `.pi/extensions/takomi-subagents/tool-runner.ts` first. It is the real compatibility seam: current mode/default behavior lives there, and it is where any “detect native subagent, align semantics, but keep Takomi metadata” work should start.
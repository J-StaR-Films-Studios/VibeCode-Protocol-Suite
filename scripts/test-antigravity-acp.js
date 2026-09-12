import assert from "node:assert";
import { AcpClient } from "../.pi/extensions/antigravity-provider/acp-client.ts";
import {
  AcpSessionManager,
  selectAllowOptionId,
} from "../.pi/extensions/antigravity-provider/acp-session.ts";
import {
  loadPersistedCatalog,
  parseEffort,
  persistCatalog,
  resolveEffortVariant,
  startupCatalog,
  toCatalogEntries,
  toPiModels,
} from "../.pi/extensions/antigravity-provider/catalog.ts";
import {
  buildTurnPrompt,
  countNonTextParts,
  decidePromptMode,
  extractText,
} from "../.pi/extensions/antigravity-provider/prompt-mapper.ts";
import {
  AntigravityProviderRuntime,
  estimateTurnUsage,
} from "../.pi/extensions/antigravity-provider/provider.ts";

console.log("🧪 Running Antigravity ACP Tests...");

// --- ND-JSON framing: split lines, skip garbage, route responses ---
{
  const received = [];
  const proto = AcpClient.prototype;
  const client = Object.create(proto);
  client.stdoutBuffer = "";
  client.pending = new Map();
  client.notificationHandlers = new Map();
  client.requestHandlers = new Map();
  client.stderrTail = "";
  client.stderrBytes = 0;

  client.pending.set(1, {
    resolve: (r) => received.push(r),
    reject: () => assert.fail("should not reject"),
  });
  client.notificationHandlers.set("session/update", new Set([(p) => received.push(p)]));

  const onStdout = (s) => proto.onStdout.call(client, Buffer.from(s));
  // Non-JSON garbage (sign-in URL style) must not break the stream.
  onStdout("Open the following link to authenticate: https://x\n");
  onStdout('{"jsonrpc":"2.0","id":1,"result":{"sessionId":"s1"}}\n');
  // Split frame across chunks.
  onStdout('{"jsonrpc":"2.0","method":"session/update","params":');
  onStdout('{"a":1}}\n');
  assert.deepStrictEqual(received[0], { sessionId: "s1" });
  assert.deepStrictEqual(received[1], { a: 1 });
  assert.ok(client.pending.size === 0, "pending must clear");
  console.log("✅ Framing: ND-JSON lines parsed, split frames joined, garbage skipped");
}

// --- Permission auto-allow selection (unlimited policy) ---
{
  assert.strictEqual(
    selectAllowOptionId([
      { optionId: "a", kind: "allow_once" },
      { optionId: "b", kind: "allow_always" },
      { optionId: "c", kind: "reject_once" },
    ]),
    "b",
    "allow_always wins",
  );
  assert.strictEqual(selectAllowOptionId([{ optionId: "a", kind: "allow_once" }]), "a");
  assert.strictEqual(selectAllowOptionId([{ optionId: "  ", kind: "allow_once" }]), undefined);
  assert.strictEqual(selectAllowOptionId([]), undefined);
  console.log("✅ Permissions: stickiest allow option selected, blanks rejected");
}

// --- Prompt mapper: first turn carries system+history, later turns are deltas ---
{
  const context = {
    systemPrompt: "You are a coder.",
    messages: [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi!" },
      { role: "user", content: [{ type: "text", text: "Fix it" }] },
    ],
  };
  const first = buildTurnPrompt(context, true);
  assert.ok(first.includes("[SYSTEM]\nYou are a coder."), "system included");
  assert.ok(first.includes("[USER]\nHello"), "history included");
  assert.ok(first.includes("[ASSISTANT]\nHi!"), "assistant history included");
  assert.ok(first.includes("[CURRENT USER REQUEST]\nFix it"), "current request included");

  const later = buildTurnPrompt(context, false);
  assert.strictEqual(later, "Fix it", "repeat turns send only the delta");

  assert.strictEqual(extractText("plain"), "plain");
  assert.strictEqual(extractText([{ type: "text", text: "a" }, { type: "image" }]), "a");
  assert.strictEqual(countNonTextParts([{ type: "text", text: "a" }, { type: "image" }]), 1);
  const withImage = buildTurnPrompt(
    { messages: [{ role: "user", content: [{ type: "image" }] }] },
    false,
  );
  assert.ok(withImage.includes("omitted"), "non-text drops are disclosed, not silent");
  console.log("✅ Prompt mapper: stateful turns, disclosed omissions");
}

// --- Catalog: live session -> entries -> Pi models, persist round-trip ---
{
  const session = {
    sessionId: "s1",
    modelConfigId: "model",
    currentModel: "gemini-3-pro",
    configOptions: [],
    availableModels: [
      { modelId: "gemini-3-pro", name: "Gemini 3 Pro" },
      { modelId: "claude-x", name: "Claude X" },
    ],
  };
  const entries = toCatalogEntries(session);
  assert.ok(entries[0].id === "antigravity/gemini-3-pro", "current model first");
  assert.strictEqual(entries.length, 2);
  const models = toPiModels(entries);
  assert.strictEqual(models[0].provider, "antigravity");
  assert.strictEqual(models[0].api, "antigravity-acp");
  assert.ok(models[0].id.startsWith("antigravity/"));

  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmp = path.join(os.tmpdir(), `agy-catalog-test-${Date.now()}.json`);
  persistCatalog(entries, tmp);
  const loaded = loadPersistedCatalog(tmp);
  assert.deepStrictEqual(loaded, entries);
  fs.unlinkSync(tmp);
  assert.strictEqual(loadPersistedCatalog(tmp), undefined, "missing file -> undefined");

  const startup = startupCatalog();
  assert.ok(Array.isArray(startup) && startup.length > 0, "startup never empty");
  console.log("✅ Catalog: live -> entries -> models, persist round-trip");
}

// --- Runtime exposes catalog models without spawning ---
{
  const runtime = new AntigravityProviderRuntime();
  const models = runtime.getModels();
  assert.ok(models.length > 0, "runtime must expose models without a server");
  assert.ok(models.every((m) => m.provider === "antigravity"));

  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmp = path.join(os.tmpdir(), `agy-runtime-catalog-${Date.now()}.json`);
  const changed = runtime.refreshCatalog([{ id: "antigravity/z-test", name: "Z Test" }], tmp);
  assert.ok(changed, "new list must report changed");
  assert.ok(
    !runtime.refreshCatalog([{ id: "antigravity/z-test", name: "Z Test" }], tmp),
    "same list -> unchanged",
  );
  assert.deepStrictEqual(
    runtime.getCatalogEntries().map((e) => e.id),
    ["antigravity/z-test"],
  );
  fs.unlinkSync(tmp);
  console.log("✅ Runtime: catalog-backed models, change detection");
}

// --- Effort grouping: low/medium/high collapse to one Pi model ---
{
  assert.deepStrictEqual(parseEffort("gemini-3.8-flash-high"), { base: "gemini-3.8-flash", effort: "high" });
  assert.deepStrictEqual(parseEffort("gemini-3.8-flash"), { base: "gemini-3.8-flash" });
  assert.deepStrictEqual(parseEffort("claude-x"), { base: "claude-x" });

  const session = {
    sessionId: "s-group",
    modelConfigId: "model",
    currentModel: "gemini-3.8-flash-high",
    configOptions: [],
    availableModels: [
      { modelId: "gemini-3.8-flash-low", name: "Flash Low" },
      { modelId: "gemini-3.8-flash-medium", name: "Flash Medium" },
      { modelId: "gemini-3.8-flash-high", name: "Flash High" },
      { modelId: "gemini-3-pro", name: "Pro" },
    ],
  };
  const entries = toCatalogEntries(session);
  assert.strictEqual(entries.length, 2, "effort variants collapse to one entry per base");
  const flash = entries.find((e) => e.id === "antigravity/gemini-3.8-flash");
  assert.ok(flash, "grouped entry uses the base id");
  assert.deepStrictEqual(
    [...(flash.variants ?? [])].sort(),
    ["gemini-3.8-flash-high", "gemini-3.8-flash-low", "gemini-3.8-flash-medium"].sort(),
  );
  assert.ok(flash.name.includes("(current)"), "current model marks its group");
  assert.ok(!entries.some((e) => e.id.endsWith("-low")), "no per-effort picker entries remain");

  assert.strictEqual(
    resolveEffortVariant(flash.variants, "low"),
    "gemini-3.8-flash-low",
    "slider low picks the low variant",
  );
  assert.strictEqual(
    resolveEffortVariant(flash.variants, undefined),
    "gemini-3.8-flash-high",
    "unset effort falls back to first known variant",
  );
  assert.strictEqual(
    resolveEffortVariant(["gemini-3.8-flash-low", "gemini-3.8-flash-high"], "medium"),
    "gemini-3.8-flash-low",
    "medium on a low/high family picks nearest instead of failing",
  );

  // Persisted grouped catalogs keep their variants across restarts.
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const tmp = path.join(os.tmpdir(), `agy-grouped-catalog-${Date.now()}.json`);
  persistCatalog(entries, tmp);
  const loaded = loadPersistedCatalog(tmp);
  assert.deepStrictEqual(loaded, entries, "variants survive persist/load");
  fs.unlinkSync(tmp);
  console.log("✅ Grouping: effort variants collapse, slider resolves variants");
}

// --- setModel: grouped base + :effort + reasoning map to ACP variants ---
{
  const mkSession = () => ({
    sessionId: "s-setmodel",
    modelConfigId: "model",
    currentModel: "gemini-3.8-flash-high",
    configOptions: [],
    availableModels: [
      { modelId: "gemini-3.8-flash-low", name: "Flash Low" },
      { modelId: "gemini-3.8-flash-medium", name: "Flash Medium" },
      { modelId: "gemini-3.8-flash-high", name: "Flash High" },
    ],
  });
  // No server spawn when the resolved variant already matches: these return
  // before ensureClient(), so they prove the mapping without a binary.
  // (Different-variant paths would spawn the real server and stay untested here.)
  const m1 = new AcpSessionManager({}, process.cwd());
  const s1 = mkSession();
  await m1.setModel(s1, "antigravity/gemini-3.8-flash", "high");
  assert.strictEqual(s1.currentModel, "gemini-3.8-flash-high", "base + reasoning keeps variant");
  const m2 = new AcpSessionManager({}, process.cwd());
  const s2 = mkSession();
  s2.currentModel = "gemini-3.8-flash-low";
  await m2.setModel(s2, "antigravity/gemini-3.8-flash-low", undefined);
  assert.strictEqual(s2.currentModel, "gemini-3.8-flash-low", "full variant id passes through");
  const m3 = new AcpSessionManager({}, process.cwd());
  const s3 = mkSession();
  s3.currentModel = "gemini-3.8-flash-low";
  await m3.setModel(s3, "antigravity/gemini-3.8-flash:low", undefined);
  assert.strictEqual(s3.currentModel, "gemini-3.8-flash-low", ":effort suffix resolves to dash variant");
  console.log("✅ setModel: grouped base + reasoning resolve without extra variants");
}

// --- Session updates: thought + tool + plan surface instead of vanishing ---
{
  const manager = new AcpSessionManager({}, process.cwd());
  const thoughts = [];
  const activities = [];
  const texts = [];
  manager.onThought((sid, text) => thoughts.push([sid, text]));
  manager.onActivity((sid, message) => activities.push([sid, message]));
  manager.onText((sid, text) => texts.push([sid, text]));

  manager.onSessionUpdate({
    sessionId: "s1",
    update: { sessionUpdate: "agent_thought_chunk", content: [{ type: "text", text: "hmm" }] },
  });
  manager.onSessionUpdate({
    sessionId: "s1",
    update: { sessionUpdate: "agent_message_chunk", content: [{ type: "text", text: "hi" }] },
  });
  manager.onSessionUpdate({
    sessionId: "s1",
    update: { sessionUpdate: "tool_call", title: "read file", status: "running" },
  });
  manager.onSessionUpdate({
    sessionId: "s1",
    update: {
      sessionUpdate: "plan",
      entries: [{ content: "edit parser", status: "in_progress" }],
    },
  });
  assert.deepStrictEqual(thoughts, [["s1", "hmm"]], "thought chunks reach the UI layer");
  assert.deepStrictEqual(texts, [["s1", "hi"]], "text still streams");
  assert.ok(activities.some(([, m]) => m.includes("read file")), "tool calls surface as activity");
  assert.ok(activities.some(([, m]) => m.includes("edit parser")), "plan progress surfaces");
  console.log("✅ Session updates: thought/tool/plan forwarded to UI");
}

// --- Model switching: missed turns are caught up, not dropped ---
{
  assert.strictEqual(decidePromptMode(1, undefined, 0, false), "full", "first turn is full");
  assert.strictEqual(decidePromptMode(5, 1, 3, true), "full", "ephemeral always full");
  assert.deepStrictEqual(
    decidePromptMode(3, 1, 1, false),
    "delta",
    "own response + new user message stays a delta",
  );
  assert.deepStrictEqual(
    decidePromptMode(6, 1, 2, false),
    { catchupFrom: 1 },
    "other-provider turns in between trigger catch-up",
  );
  assert.strictEqual(decidePromptMode(1, 5, 2, false), "full", "rewritten history resyncs");

  const context = {
    systemPrompt: "You are a coder.",
    messages: [
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1 ours" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2 gpt" },
      { role: "user", content: "u3 what did we discuss?" },
    ],
  };
  const catchup = buildTurnPrompt(context, false, 1);
  assert.ok(catchup.includes("CATCH-UP"), "catch-up is labeled");
  assert.ok(catchup.includes("a2 gpt"), "missed GPT turn is included");
  assert.ok(catchup.includes("u3 what did we discuss?"), "current request included");
  assert.ok(!catchup.includes("a1 ours"), "own bridged response is not duplicated");
  assert.ok(!catchup.includes("[SYSTEM]"), "system is not resent on catch-up");

  const full = buildTurnPrompt(context, true);
  assert.ok(full.includes("[SYSTEM]"), "first turn still carries system");
  assert.ok(full.includes("a1 ours") && full.includes("a2 gpt"), "first turn carries all history");
  console.log("✅ Switching: missed turns catch up without duplicating own history");
}

// --- Thinking stream: start event must already carry the block ---
{
  const runtime = new AntigravityProviderRuntime();
  const model = runtime.getModels()[0];
  // Empty thinking still yields a thinking block at index 0: the chat
  // component attaches live deltas by contentIndex, and without the block in
  // thinking_start everything renders as one blob at the end.
  const empty = runtime.partialMessage(model, "", "");
  assert.strictEqual(empty.content[0]?.type, "thinking", "thinking block present even when empty");
  const withText = runtime.partialMessage(model, "hi", "hmm");
  assert.strictEqual(withText.content[0]?.type, "thinking", "thinking stays at index 0");
  assert.strictEqual(withText.content[1]?.type, "text", "text follows at index 1");
  const noThinking = runtime.partialMessage(model, "hi", undefined);
  assert.strictEqual(noThinking.content[0]?.type, "text", "no thinking block without thoughts");
  console.log("✅ Thinking stream: start partial carries the block for live deltas");
}

// --- Stream protocol: start first or the agent loop swallows deltas ---
{
  const runtime = new AntigravityProviderRuntime();
  runtime.refreshCatalogInBackground = () => {};
  const textHandlers = [];
  const thoughtHandlers = [];
  const activityHandlers = [];
  runtime.manager = {
    onText: (h) => { textHandlers.push(h); return () => {}; },
    onThought: (h) => { thoughtHandlers.push(h); return () => {}; },
    onActivity: (h) => { activityHandlers.push(h); return () => {}; },
    tryClaimMain: async () => ({
      session: {
        sessionId: "s-fake",
        modelConfigId: "model",
        currentModel: "fake-model",
        configOptions: [],
        availableModels: [],
      },
      release: () => {},
    }),
    setModel: async () => {},
    prompt: async (session) => {
      for (const h of thoughtHandlers) h(session.sessionId, "hmm");
      for (const h of activityHandlers) h(session.sessionId, "tool fake (running)");
      for (const h of textHandlers) h(session.sessionId, "hi");
      return "end_turn";
    },
  };
  const model = runtime.getModels()[0];
  const stream = runtime.stream(
    model,
    { messages: [{ role: "user", content: "hey" }] },
    {},
  );
  const types = [];
  let doneMessage;
  for await (const event of stream) {
    types.push(event.type);
    if (event.type === "done") doneMessage = event.message;
  }
  assert.strictEqual(types[0], "start", "start opens the stream or deltas never reach chat");
  assert.ok(types.includes("thinking_start"), "thoughts stream");
  assert.ok(types.includes("thinking_delta"), "thought deltas stream");
  assert.ok(types.includes("text_delta"), "text streams");
  assert.strictEqual(types.at(-1), "done", "done closes the stream");
  assert.ok(
    doneMessage.content.some((b) => b.type === "thinking"),
    "thinking block survives to the final message",
  );
  assert.ok(
    (doneMessage.usage.input ?? 0) > 0 && (doneMessage.usage.output ?? 0) > 0,
    "usage is estimated, not zero",
  );
  console.log("✅ Stream protocol: start first, live deltas, estimated usage");
}

// --- Usage: estimated tokens instead of permanent zeros ---
{
  const usage = estimateTurnUsage("abcd", "abcdefgh");
  assert.strictEqual(usage.input, 1, "input estimated chars/4");
  assert.strictEqual(usage.output, 2, "output estimated chars/4");
  assert.strictEqual(usage.totalTokens, 3, "total is the sum");
  console.log("✅ Usage: estimated tokens follow Pi chars/4 convention");
}

console.log("🎉 All Antigravity ACP Tests Passed!");

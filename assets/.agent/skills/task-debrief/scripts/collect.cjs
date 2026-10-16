#!/usr/bin/env node
// Sum only explicitly owned Pi journals. This script never discovers children by directory glob.
const fs = require('node:fs');
const path = require('node:path');

function fail(message) { throw new Error(message); }
function argsOf(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) fail(`Expected --key value near ${argv[i]}`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}
function parseDate(value, label) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`Invalid ${label}: ${value}`);
  return ms;
}
function journal(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const entries = [];
  let incomplete = false;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    try { entries.push(JSON.parse(lines[i])); }
    catch (error) {
      if (i === lines.length - 1) { incomplete = true; break; }
      fail(`Invalid JSONL at ${file}:${i + 1}: ${error.message}`);
    }
  }
  const session = entries.find(row => row.type === 'session');
  if (!session?.id) fail(`No Pi session header: ${file}`);
  return { entries, session, incomplete, name: entries.filter(row => row.type === 'session_info').at(-1)?.name ?? null };
}
function empty() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0,
    cost: 0, assistantResponses: 0, compactions: 0, toolCalls: 0, userMessages: 0,
    usageWithoutCost: 0, models: {}, first: null, last: null };
}
const keys = ['input','output','cacheRead','cacheWrite','reasoning','totalTokens','cost','assistantResponses','compactions','toolCalls','userMessages','usageWithoutCost'];
function sumInto(target, source) {
  for (const key of keys) target[key] += source[key];
  for (const [name, value] of Object.entries(source.models)) {
    const model = target.models[name] ??= { calls: 0, totalTokens: 0, cost: 0 };
    model.calls += value.calls; model.totalTokens += value.totalTokens; model.cost += value.cost;
  }
}
function collect(entries, start, cutoff) {
  const out = empty();
  const seen = new Set();
  for (const row of entries) {
    const time = Date.parse(row.timestamp);
    if (!Number.isFinite(time) || time < start || time > cutoff) continue;
    if (row.type === 'message' && row.message?.role === 'user') out.userMessages++;
    const compact = row.type === 'compaction';
    if (!compact && (row.type !== 'message' || row.message?.role !== 'assistant')) continue;
    const usage = compact ? row.usage : row.message.usage;
    if (!usage) continue;
    const id = `${row.id}:${row.timestamp}`;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const key of ['input','output','cacheRead','cacheWrite','reasoning']) out[key] += usage[key] ?? 0;
    out.totalTokens += usage.totalTokens ?? 0;
    if (typeof usage.cost?.total === 'number') out.cost += usage.cost.total;
    else out.usageWithoutCost++;
    if (compact) out.compactions++; else {
      out.assistantResponses++;
      out.toolCalls += (row.message.content ?? []).filter(part => part.type === 'toolCall').length;
    }
    const name = compact ? 'compaction/model-not-recorded' : `${row.message.provider ?? 'unknown'}/${row.message.model ?? 'unknown'}`;
    const model = out.models[name] ??= { calls: 0, totalTokens: 0, cost: 0 };
    model.calls++; model.totalTokens += usage.totalTokens ?? 0; model.cost += usage.cost?.total ?? 0;
    out.first ??= row.timestamp;
    out.last = row.timestamp;
  }
  return out;
}
function duration(ms) { const minutes = Math.round(ms / 60000); return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`; }
function dollars(n) { return `$${n.toFixed(2)}`; }
function safe(label) { return String(label).replaceAll('|', '\\|').replaceAll('\n', ' '); }

function main() {
  const args = argsOf(process.argv.slice(2));
  const parentFile = args.parent || process.env.PI_SESSION_FILE;
  if (!parentFile || !args.out || !args.manifest || !args['parent-thread'] || args['expected-children'] === undefined) fail('Provide --parent, --parent-thread, --expected-children, --manifest and --out');
  const expected = Number(args['expected-children']);
  if (!Number.isSafeInteger(expected) || expected < 0) fail('Invalid --expected-children');
  const parent = journal(parentFile);
  const start = parseDate(args.start ?? parent.session.timestamp, 'start');
  const cutoff = parseDate(args.cutoff ?? new Date().toISOString(), 'cutoff');
  if (start > cutoff) fail('Start is after cutoff');
  const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
  if (!Array.isArray(manifest.children)) fail('Manifest requires {"children":[]}');
  if (manifest.children.length !== expected) fail(`Expected ${expected} descendants, got ${manifest.children.length} entries`);
  const ids = new Set([args['parent-thread']]);
  const byThread = new Map(manifest.children.map(child => [child.threadId, child]));
  const sessionIds = new Set([parent.session.id]);
  const filePaths = new Set([path.resolve(parentFile)]);
  const warnings = [];
  if (parent.incomplete) warnings.push('Parent journal ends in a partial line; some usage may be missing.');
  const children = manifest.children.map(child => {
    if (!child.threadId || !child.parentThreadId || !child.title) fail('Each child needs threadId, parentThreadId and title');
    if (ids.has(child.threadId)) fail(`Duplicate threadId: ${child.threadId}`);
    ids.add(child.threadId);
    const item = { threadId: child.threadId, parentThreadId: child.parentThreadId, title: child.title,
      status: child.status ?? null, sessionId: null, sessionName: null, journalMatched: false,
      runCount: Array.isArray(child.runs) ? child.runs.length : null, runElapsedMs: 0,
      completedRunElapsedMs: 0, usage: null };
    if (!Array.isArray(child.runs)) warnings.push(`Run metadata unavailable: ${child.title}`);
    for (const run of child.runs ?? []) {
      if (!run.startedAt || !run.completedAt) { warnings.push(`Run duration unavailable: ${child.title}`); continue; }
      const elapsed = parseDate(run.completedAt, 'run end') - parseDate(run.startedAt, 'run start');
      if (elapsed < 0) fail(`Negative run duration: ${child.title}`);
      item.runElapsedMs += elapsed;
      if (run.status === 'completed') item.completedRunElapsedMs += elapsed;
    }
    if (!child.sessionFile) { warnings.push(`No local Pi usage journal: ${child.title}`); return item; }
    const absolute = path.resolve(child.sessionFile);
    if (filePaths.has(absolute)) fail(`Journal attributed twice: ${absolute}`);
    filePaths.add(absolute);
    const data = journal(absolute);
    if (sessionIds.has(data.session.id)) fail(`Pi session attributed twice: ${data.session.id}`);
    sessionIds.add(data.session.id);
    if (child.sessionId && child.sessionId !== data.session.id) fail(`Session ID mismatch: ${child.title}`);
    if (data.incomplete) warnings.push(`Partial journal: ${child.title}`);
    if (data.name && data.name !== child.title) warnings.push(`Different T3 title/Pi session name for ${child.title}; confirm identity manually.`);
    const created = parseDate(data.session.timestamp, `session start ${child.title}`);
    if (created < start - 300000 || created > cutoff + 300000) warnings.push(`Child journal begins outside task window: ${child.title}`);
    if (child.createdAt && Math.abs(created - parseDate(child.createdAt, `T3 creation ${child.title}`)) > 300000) warnings.push(`T3 creation time differs from Pi journal by over five minutes: ${child.title}`);
    item.sessionId = data.session.id;
    item.sessionName = data.name;
    item.journalMatched = true;
    item.usage = collect(data.entries, start, cutoff);
    if (item.usage.usageWithoutCost) warnings.push(`Unpriced usage calls: ${child.title}`);
    return item;
  });
  for (const child of children) {
    const chain = new Set([child.threadId]);
    let parentId = child.parentThreadId;
    while (parentId !== args['parent-thread']) {
      if (chain.has(parentId) || !byThread.has(parentId)) fail(`Unowned descendant or cycle: ${child.title}`);
      chain.add(parentId);
      parentId = byThread.get(parentId).parentThreadId;
    }
  }
  const parentUsage = collect(parent.entries, start, cutoff);
  if (parentUsage.usageWithoutCost) warnings.push('Unpriced parent usage calls.');
  const totals = empty();
  sumInto(totals, parentUsage);
  for (const child of children) if (child.usage) sumInto(totals, child.usage);
  const matchedChildren = children.filter(child => child.journalMatched).length;
  const complete = matchedChildren === expected && !warnings.some(message => /usage|partial journal|journal ends|outside task window|creation time differs/i.test(message));
  const report = { generatedAt: new Date().toISOString(), scope: { parentThreadId: args['parent-thread'], parentSessionId: parent.session.id,
      start: new Date(start).toISOString(), cutoff: new Date(cutoff).toISOString(), elapsedMs: cutoff - start,
      expectedChildren: expected, matchedChildren, completeRecordedUsage: complete },
    parent: { sessionId: parent.session.id, usage: parentUsage }, children, totals, warnings };
  if (fs.existsSync(path.join(args.out, 'usage.json')) || fs.existsSync(path.join(args.out, 'usage.md'))) fail(`Refusing to overwrite an existing audit in ${args.out}`);
  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(path.join(args.out, 'usage.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const rows = children.map(child => `| ${safe(child.title)} | ${child.journalMatched ? dollars(child.usage.cost) : 'unknown'} | ${child.journalMatched ? child.usage.totalTokens.toLocaleString('en-US') : 'unknown'} | ${child.runCount ?? 'unknown'} | ${child.runCount === null ? 'unknown' : duration(child.runElapsedMs)} |`).join('\n');
  const md = `# Logged usage\n\nTask window: ${report.scope.start} to ${report.scope.cutoff} (${duration(report.scope.elapsedMs)} calendar time).\n\n| Scope | Known estimate | Processed tokens |\n| --- | ---: | ---: |\n| Parent | ${dollars(parentUsage.cost)} | ${parentUsage.totalTokens.toLocaleString('en-US')} |\n| ${expected} owned child agents | ${dollars(totals.cost - parentUsage.cost)} | ${(totals.totalTokens - parentUsage.totalTokens).toLocaleString('en-US')} |\n| Known logged total | ${dollars(totals.cost)} | ${totals.totalTokens.toLocaleString('en-US')} |\n\n| Child agent | Estimate | Tokens | Runs | Run elapsed |\n| --- | ---: | ---: | ---: | ---: |\n${rows || '| None | - | - | - | - |'}\n\nMatched ${matchedChildren}/${expected} child journals. ${complete ? 'All specified Pi usage records have logged cost.' : 'Known logged total is partial; unknown usage may increase it.'} ${totals.compactions} compaction calls included. Input: ${totals.input.toLocaleString('en-US')} uncached, ${totals.cacheRead.toLocaleString('en-US')} cached; output: ${totals.output.toLocaleString('en-US')} (reasoning is included, not added twice). Reused cache tokens are counted on every call.\n\nRun elapsed includes waits and interruptions; agents can overlap. This is neither active compute time nor billed hours. Logged model costs are estimates, not a verified payment. Subscription fees, outside reviewers and infrastructure costs are unknown. The current retrospective's model usage after the cutoff is excluded.\n\n${warnings.length ? `## Coverage warnings\n\n${warnings.map(w => `- ${safe(w)}`).join('\n')}\n` : ''}`;
  fs.writeFileSync(path.join(args.out, 'usage.md'), md, { flag: 'wx' });
  console.log(JSON.stringify({ directory: args.out, estimate: totals.cost, expectedChildren: expected, matchedChildren, complete, warnings }));
}
try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import pc from 'picocolors';

const PRICES = {
  'gpt-5.5': [5.00, 0.50, 30.00],
  'gpt-5.4': [2.50, 0.25, 15.00],
  'gpt-5.4-mini': [0.75, 0.075, 4.50],
  'gpt-5.4-nano': [0.20, 0.02, 1.25],
  'gpt-5.3-codex': [2.50, 0.25, 15.00],
  'gpt-5.2-codex': [1.75, 0.175, 14.00],
  'gpt-5-codex': [1.25, 0.125, 10.00],
  'gpt-5.2': [1.75, 0.175, 14.00],
  'gpt-5.1': [1.25, 0.125, 10.00],
  'gpt-5': [1.25, 0.125, 10.00],
  'gpt-5-mini': [0.25, 0.025, 2.00],
  'gpt-4.1': [2.00, 0.50, 8.00],
  'gpt-4o': [2.50, 1.25, 10.00],
  'o4-mini': [1.10, 0.275, 4.40],
  'claude-sonnet-4-6': [3.00, 0.30, 15.00],
};

function safeJson(line) { try { return JSON.parse(line); } catch { return null; } }
function dayOf(ts) { return typeof ts === 'string' && ts.length >= 10 ? ts.slice(0, 10) : 'unknown'; }
function add(map, key, patch) { const row = map.get(key) || { key, input: 0, cache: 0, output: 0, total: 0, cost: 0, events: 0 }; for (const [k,v] of Object.entries(patch)) row[k] = (row[k] || 0) + (Number(v) || 0); if (!Object.prototype.hasOwnProperty.call(patch, 'events')) row.events += 1; map.set(key, row); }
function cost(model, input, cache, output, additiveCache = true) { const p = PRICES[model]; if (!p) return 0; const nonCached = additiveCache ? input : Math.max(input - cache, 0); return (nonCached*p[0] + cache*p[1] + output*p[2]) / 1_000_000; }
function fmtTokens(n) { if (n >= 1e9) return `${(n/1e9).toFixed(2)}B`; if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return String(Math.round(n || 0)); }
function fmtMoney(n) { return `$${(n || 0).toFixed(n > 100 ? 0 : 2)}`; }
function ms(n) { if (!n) return '-'; const s = Math.round(n/1000); if (s < 60) return `${s}s`; const m = Math.floor(s/60); if (m < 60) return `${m}m ${s%60}s`; const h = Math.floor(m/60); return `${h}h ${m%60}m`; }

async function files(root, suffix = '.jsonl') {
  const out = [];
  if (!root || !(await fs.pathExists(root))) return out;
  async function walk(dir) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p); else if (ent.name.endsWith(suffix)) out.push(p);
    }
  }
  await walk(root); return out;
}

async function scanPiSessions(root, source, events) {
  for (const file of await files(root)) {
    let provider = 'unknown', model = 'unknown', session = path.basename(file, '.jsonl');
    const text = await fs.readFile(file, 'utf8').catch(() => '');
    for (const line of text.split(/\r?\n/)) {
      const obj = safeJson(line); if (!obj) continue;
      if (obj.type === 'session') session = obj.id || session;
      if (obj.type === 'model_change') { provider = obj.provider || provider; model = obj.modelId || model; }
      const u = obj.type === 'message' && obj.message && obj.message.usage;
      if (u) events.push({ source, file, timestamp: obj.timestamp, day: dayOf(obj.timestamp), session, provider, model, input: +u.input||0, cache: +u.cacheRead||0, output: +u.output||0, total: +u.totalTokens||0, cost: cost(model, +u.input||0, +u.cacheRead||0, +u.output||0, true) });
    }
  }
}

async function scanRunHistory(file) {
  const runs = [];
  if (!(await fs.pathExists(file))) return runs;
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  for (const line of text.split(/\r?\n/)) { const o = safeJson(line); if (o) runs.push(o); }
  return runs;
}

export async function collectTakomiStats(opts = {}) {
  const home = opts.home || os.homedir();
  const cwd = opts.cwd || process.cwd();
  const events = [];
  await scanPiSessions(path.join(home, '.pi', 'agent', 'sessions'), 'pi-global', events);
  await scanPiSessions(path.join(cwd, '.pi', 'agent', 'sessions'), 'pi-project', events);
  await scanPiSessions(path.join(cwd, '.pi', 'takomi'), 'takomi-project', events);
  const runs = await scanRunHistory(path.join(home, '.pi', 'agent', 'run-history.jsonl'));
  const byDay = new Map(), byModel = new Map(), bySource = new Map();
  let totals = { input: 0, cache: 0, output: 0, total: 0, cost: 0, events: events.length };
  for (const e of events) {
    totals.input += e.input; totals.cache += e.cache; totals.output += e.output; totals.total += e.total; totals.cost += e.cost;
    add(byDay, e.day, e); add(byModel, e.model, e); add(bySource, e.source, e);
  }
  const byAgent = new Map(); let longestRun = null;
  for (const r of runs) { add(byAgent, r.agent || 'unknown', { total: 0, events: 1 }); if (!longestRun || (+r.duration||0) > (+longestRun.duration||0)) longestRun = r; }
  return { generatedAt: new Date().toISOString(), cwd, totals, sessions: new Set(events.map(e => e.session)).size, byDay: [...byDay.values()].sort((a,b)=>a.key.localeCompare(b.key)), byModel: [...byModel.values()].sort((a,b)=>b.total-a.total), bySource: [...bySource.values()].sort((a,b)=>b.total-a.total), byAgent: [...byAgent.values()].sort((a,b)=>b.events-a.events), runs, longestRun, recent: events.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||'')).slice(0, 10) };
}

function heat(days) {
  const max = Math.max(1, ...days.map(d => d.total));
  const cells = days.slice(-180).map(d => { const x = d.total / max; return x === 0 ? pc.gray('·') : x < .12 ? pc.gray('░') : x < .35 ? pc.cyan('▒') : x < .7 ? pc.blue('▓') : pc.magenta('█'); });
  const lines = []; for (let i=0;i<cells.length;i+=60) lines.push(cells.slice(i,i+60).join(''));
  return lines.join('\n');
}

export function renderTakomiStats(stats, opts = {}) {
  const topModel = stats.byModel[0]?.key || 'unknown';
  const peak = stats.byDay.reduce((a,b)=> b.total > (a?.total||0) ? b : a, null);
  const lines = [];
  lines.push(pc.magenta('╭──────────────────── Takomi Stats ────────────────────╮'));
  lines.push(`  ${pc.bold(fmtTokens(stats.totals.total))} lifetime tokens   ${fmtMoney(stats.totals.cost)} est.   ${stats.sessions} sessions`);
  lines.push(`  ${fmtTokens(stats.totals.cache)} cache tokens      ${stats.runs.length} agent runs   top model: ${topModel}`);
  lines.push(`  peak day: ${peak ? `${peak.key} / ${fmtTokens(peak.total)}` : '-'}   longest agent run: ${ms(stats.longestRun?.duration)}`);
  lines.push(pc.magenta('╰───────────────────────────────────────────────────────╯'));
  lines.push('\nToken activity');
  lines.push(heat(stats.byDay));
  lines.push('\nTop models');
  for (const r of stats.byModel.slice(0, opts.limit || 8)) lines.push(`  ${r.key.padEnd(22)} ${fmtTokens(r.total).padStart(8)}  ${fmtMoney(r.cost).padStart(8)}  ${r.events} calls`);
  lines.push('\nSources');
  for (const r of stats.bySource) lines.push(`  ${r.key.padEnd(16)} ${fmtTokens(r.total).padStart(8)}  ${r.events} events`);
  if (stats.byAgent.length) { lines.push('\nTop agents'); for (const r of stats.byAgent.slice(0, opts.limit || 8)) lines.push(`  ${r.key.padEnd(18)} ${String(r.events).padStart(5)} runs`); }
  lines.push(pc.dim('\nPrivacy: metadata only; raw prompts/transcripts are not printed. Costs are estimates when provider prices are unknown.'));
  return lines.join('\n');
}

export async function printTakomiStats(options = {}) {
  const stats = await collectTakomiStats(options);
  if (options.json) console.log(JSON.stringify(stats, null, 2)); else console.log(renderTakomiStats(stats, options));
}

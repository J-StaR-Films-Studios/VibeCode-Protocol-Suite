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
function parseSince(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  const rel = raw.match(/^(\d+)(d|day|days|w|week|weeks|m|month|months)$/);
  const d = new Date(); d.setHours(0,0,0,0);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2][0];
    d.setDate(d.getDate() - (unit === 'w' ? n * 7 : unit === 'm' ? n * 30 : n));
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}
function projectKey(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  const marker = '/sessions/';
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    const encoded = normalized.slice(idx + marker.length).split('/')[0];
    return encoded.replace(/^--/, '').replace(/--$/, '').replace(/--/g, '/').replace(/-/g, ' ').trim() || 'global';
  }
  const cwdMarker = '/.pi/';
  const pidx = normalized.indexOf(cwdMarker);
  if (pidx >= 0) return normalized.slice(0, pidx).split('/').slice(-2).join('/');
  return 'unknown';
}

// ── ANSI-aware string helpers ───────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;]*m/g;
function stripAnsi(s) { return String(s).replace(ANSI_RE, ''); }
function visLen(s) { return stripAnsi(s).length; }
function ansiPadEnd(s, w) { return s + ' '.repeat(Math.max(0, w - visLen(s))); }
function ansiPadStart(s, w) { return ' '.repeat(Math.max(0, w - visLen(s))) + s; }

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
  const rawEvents = [];
  await scanPiSessions(path.join(home, '.pi', 'agent', 'sessions'), 'pi-global', rawEvents);
  await scanPiSessions(path.join(cwd, '.pi', 'agent', 'sessions'), 'pi-project', rawEvents);
  await scanPiSessions(path.join(cwd, '.pi', 'takomi'), 'takomi-project', rawEvents);
  const sinceDay = parseSince(opts.since);
  const events = rawEvents
    .filter(e => !sinceDay || e.day >= sinceDay)
    .map(e => ({ ...e, project: projectKey(e.file) }));
  const runs = await scanRunHistory(path.join(home, '.pi', 'agent', 'run-history.jsonl'));
  const byDay = new Map(), byModel = new Map(), bySource = new Map(), byProject = new Map();
  let totals = { input: 0, cache: 0, output: 0, total: 0, cost: 0, events: events.length };
  for (const e of events) {
    totals.input += e.input; totals.cache += e.cache; totals.output += e.output; totals.total += e.total; totals.cost += e.cost;
    add(byDay, e.day, e); add(byModel, e.model, e); add(bySource, e.source, e); add(byProject, e.project, e);
  }
  const byAgent = new Map(); let longestRun = null;
  for (const r of runs) { add(byAgent, r.agent || 'unknown', { total: 0, events: 1 }); if (!longestRun || (+r.duration||0) > (+longestRun.duration||0)) longestRun = r; }
  return { generatedAt: new Date().toISOString(), cwd, since: sinceDay, totals, sessions: new Set(events.map(e => e.session)).size, byDay: [...byDay.values()].sort((a,b)=>a.key.localeCompare(b.key)), byModel: [...byModel.values()].sort((a,b)=>b.total-a.total), bySource: [...bySource.values()].sort((a,b)=>b.total-a.total), byProject: [...byProject.values()].sort((a,b)=>b.total-a.total), byAgent: [...byAgent.values()].sort((a,b)=>b.events-a.events), runs, longestRun, recent: events.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||'')).slice(0, 10) };
}

// ── Streak Calculation ──────────────────────────────────────────────────────
function calcStreaks(byDay) {
  if (!byDay.length) return { current: 0, longest: 0, quietDays: 0 };
  const daySet = new Set(byDay.map(d => d.key));
  const today = new Date(); today.setHours(0,0,0,0);
  // current streak: walk back from today
  let current = 0;
  for (let d = new Date(today); ; d.setDate(d.getDate() - 1)) {
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) current++; else break;
  }
  // longest streak: walk all sorted days
  const sorted = [...daySet].sort();
  let longest = 0, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]); prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().slice(0, 10) === sorted[i]) { run++; } else { longest = Math.max(longest, run); run = 1; }
  }
  longest = Math.max(longest, run);
  // quiet days
  const first = new Date(sorted[0]);
  const span = Math.round((today - first) / 86400000) + 1;
  return { current, longest, quietDays: Math.max(0, span - sorted.length) };
}

// ── GitHub-style Heatmap Grid ───────────────────────────────────────────────
function heatmapGrid(byDay) {
  const dayMap = new Map(byDay.map(d => [d.key, d.total]));
  const max = Math.max(1, ...byDay.map(d => d.total));

  // Determine range: last ~26 weeks (half year) ending at current week
  const today = new Date(); today.setHours(0,0,0,0);
  // End at end of current week (Sunday)
  const endDate = new Date(today);
  const todayDow = endDate.getDay(); // 0=Sun, 1=Mon...
  if (todayDow !== 0) endDate.setDate(endDate.getDate() + (7 - todayDow));
  // Start 26 weeks back on Monday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (26 * 7) + 1);
  while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() - 1);

  // Build grid: 7 rows (Mon..Sun), N columns (weeks)
  const weeks = [];
  const monthPositions = []; // { col, label }
  const cursor = new Date(startDate);
  let col = 0;
  let lastMonth = -1;

  while (cursor <= endDate) {
    const week = [];
    for (let dow = 0; dow < 7; dow++) {
      const key = cursor.toISOString().slice(0, 10);
      const val = cursor <= today ? (dayMap.get(key) || 0) : -1; // -1 = future
      week.push(val);
      // Track month transitions on the Monday of each week
      if (dow === 0) {
        const m = cursor.getMonth();
        if (m !== lastMonth) {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          monthPositions.push({ col, label: monthNames[m] });
          lastMonth = m;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    col++;
  }

  // Intensity cell — use ■ for filled, · for empty
  const SQ = '■';
  const EMPTY = '·';
  function cell(val) {
    if (val < 0) return ' ';  // future
    if (val === 0) return pc.gray(EMPTY);
    const x = val / max;
    if (x < 0.12) return pc.dim(pc.cyan(SQ));
    if (x < 0.30) return pc.cyan(SQ);
    if (x < 0.55) return pc.blue(SQ);
    if (x < 0.80) return pc.magenta(SQ);
    return pc.bold(pc.magenta(SQ));
  }

  const dayLabels = ['Mon','   ','Wed','   ','Fri','   ','Sun'];
  const rows = [];

  // Each cell is 2 chars wide (char + space) in the grid
  for (let dow = 0; dow < 7; dow++) {
    const prefix = pc.dim(dayLabels[dow]);
    const cells = weeks.map(w => cell(w[dow]));
    rows.push(`    ${prefix} ${cells.join(' ')}`);
  }

  // Month label row — positioned under the correct columns
  // Each column is 2 chars wide (cell + space separator)
  let labelStr = '';
  let prevEnd = 0;
  for (const ml of monthPositions) {
    const targetPos = ml.col * 2; // 2 chars per column (char + space)
    const gap = Math.max(0, targetPos - prevEnd);
    labelStr += ' '.repeat(gap) + ml.label;
    prevEnd = targetPos + ml.label.length;
  }
  rows.push(`        ${pc.dim(labelStr)}`);

  // Legend row
  rows.push('');
  rows.push(`    ${pc.dim('Less')} ${pc.gray(EMPTY)} ${pc.dim(pc.cyan(SQ))} ${pc.cyan(SQ)} ${pc.blue(SQ)} ${pc.magenta(SQ)} ${pc.bold(pc.magenta(SQ))} ${pc.dim('More')}`);

  return rows.join('\n');
}

// ── Box Drawing Helpers ─────────────────────────────────────────────────────
function hrule(w, ch = '─') { return ch.repeat(w); }

function center(text, width) {
  const vl = visLen(text);
  const pad = Math.max(0, Math.floor((width - vl) / 2));
  return ' '.repeat(pad) + text;
}

function statCard(value, label) {
  return { value: String(value), label };
}

// ── Table Helper ────────────────────────────────────────────────────────────
function renderTable(title, rows, columns) {
  const lines = [];
  lines.push('  ' + pc.bold(pc.cyan(title)));
  lines.push('  ' + pc.dim(hrule(columns.reduce((s, c) => s + c.width, 0) + columns.length * 2)));
  for (const row of rows) {
    let line = '  ';
    for (const col of columns) {
      const val = String(col.get(row));
      line += col.align === 'right' ? ansiPadStart(val, col.width) : ansiPadEnd(val, col.width);
      line += '  ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function renderFocusedView(stats, opts = {}) {
  const view = opts.view;
  const limit = opts.limit || 20;
  if (!view || view === 'overview') return null;
  const tables = {
    models: ['Top Models', stats.byModel, [
      { width: 26, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
      { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
    ]],
    sources: ['Sources', stats.bySource, [
      { width: 22, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 14, align: 'right', get: r => pc.dim(r.events + ' events') },
    ]],
    projects: ['Top Projects', stats.byProject, [
      { width: 42, align: 'left', get: r => pc.white(r.key.length > 42 ? '…' + r.key.slice(-41) : r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
      { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
    ]],
    agents: ['Top Agents', stats.byAgent, [
      { width: 24, align: 'left', get: r => pc.white(r.key) },
      { width: 8, align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 8, align: 'left', get: () => pc.dim('runs') },
    ]],
    daily: ['Daily Usage', [...stats.byDay].reverse(), [
      { width: 12, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
      { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
    ]],
  };
  const spec = tables[view === 'project' ? 'projects' : view];
  if (!spec) return null;
  const [title, rows, cols] = spec;
  const suffix = stats.since ? pc.dim(`\n  Since: ${stats.since}`) : '';
  return ['\n' + pc.bold(pc.magenta('Takomi Stats')), suffix, renderTable(title, rows.slice(0, limit), cols), '\n' + pc.dim('Privacy: metadata only · no raw prompts or transcripts')].filter(Boolean).join('\n');
}

// ── Main Render ─────────────────────────────────────────────────────────────
export function renderTakomiStats(stats, opts = {}) {
  const focused = renderFocusedView(stats, opts);
  if (focused) return focused;
  const W = Math.min(process.stdout.columns || 80, 86);
  const topModel = stats.byModel[0]?.key || 'unknown';
  const peak = stats.byDay.reduce((a,b) => b.total > (a?.total||0) ? b : a, null);
  const streaks = calcStreaks(stats.byDay);
  const lines = [];

  // ── Header ────────────────────────────────────────────────────────────
  lines.push('');
  lines.push(pc.cyan('  ' + hrule(W - 4, '━')));
  lines.push('');
  lines.push(center(pc.bold(pc.white('T A K O M I   S T A T S')), W));
  const user = process.env.USERNAME || process.env.USER || 'local';
  lines.push(center(pc.dim(`@${user}  ·  Takomi`), W));
  lines.push('');
  lines.push(pc.cyan('  ' + hrule(W - 4)));

  // ── Stat Cards Row 1 ─────────────────────────────────────────────────
  const cards1 = [
    statCard(fmtTokens(stats.totals.total), 'Lifetime Tokens'),
    statCard(fmtTokens(stats.totals.cache), 'Cache Tokens'),
    statCard(fmtMoney(stats.totals.cost), 'Est. Cost'),
    statCard(String(stats.sessions), 'Sessions'),
    statCard(String(stats.runs.length), 'Agent Runs'),
  ];

  const cardW = Math.floor((W - 4) / cards1.length);


  function buildCardLines(cards) {
    let vStr = '  ';
    let lStr = '  ';
    for (const c of cards) {
      const vPad = Math.max(0, Math.floor((cardW - c.value.length) / 2));
      const lPad = Math.max(0, Math.floor((cardW - c.label.length) / 2));
      const vContent = ' '.repeat(vPad) + pc.bold(pc.white(c.value));
      const lContent = ' '.repeat(lPad) + pc.dim(c.label);
      // Pad to cardW visible chars
      vStr += ansiPadEnd(vContent, cardW);
      lStr += ansiPadEnd(lContent, cardW);
    }
    return [vStr, lStr];
  }

  lines.push('');
  const [v1, l1] = buildCardLines(cards1);
  lines.push(v1);
  lines.push(l1);

  // ── Stat Cards Row 2 ─────────────────────────────────────────────────
  lines.push('');
  const cards2 = [
    statCard(peak ? fmtTokens(peak.total) : '-', 'Peak Day'),
    statCard(topModel, 'Top Model'),
    statCard(ms(stats.longestRun?.duration), 'Longest Run'),
    statCard(`${streaks.current} days`, 'Current Streak'),
    statCard(`${streaks.longest} days`, 'Longest Streak'),
  ];

  const [v2, l2] = buildCardLines(cards2);
  lines.push(v2);
  lines.push(l2);

  // ── Info line ─────────────────────────────────────────────────────────
  lines.push('');
  const infoText = `Peak: ${peak?.key || '-'}  ·  ${streaks.quietDays} quiet days  ·  ${stats.totals.events.toLocaleString()} events${stats.since ? `  ·  since ${stats.since}` : ''}`;
  lines.push(center(pc.dim(infoText), W));

  lines.push('');
  lines.push(pc.cyan('  ' + hrule(W - 4, '━')));

  // ── Activity Heatmap ────────────────────────────────────────────────────
  lines.push('');
  lines.push('  ' + pc.bold(pc.cyan('Token Activity')));
  lines.push('  ' + pc.dim(hrule(W - 4)));
  lines.push(heatmapGrid(stats.byDay));

  // ── Models Table ────────────────────────────────────────────────────────
  lines.push('');
  const modelLimit = opts.limit || 8;
  lines.push(renderTable('Top Models', stats.byModel.slice(0, modelLimit), [
    { width: 24, align: 'left',  get: r => pc.white(r.key) },
    { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
    { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
    { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
  ]));

  // ── Projects Table ──────────────────────────────────────────────────────
  if (stats.byProject.length) {
    lines.push('');
    lines.push(renderTable('Top Projects', stats.byProject.slice(0, 5), [
      { width: 34, align: 'left',  get: r => pc.white(r.key.length > 34 ? '…' + r.key.slice(-33) : r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
    ]));
  }

  // ── Sources Table ───────────────────────────────────────────────────────
  lines.push('');
  lines.push(renderTable('Sources', stats.bySource, [
    { width: 20, align: 'left',  get: r => pc.white(r.key) },
    { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
    { width: 14, align: 'right', get: r => pc.dim(r.events + ' events') },
  ]));

  // ── Agents Table ────────────────────────────────────────────────────────
  if (stats.byAgent.length) {
    lines.push('');
    lines.push(renderTable('Top Agents', stats.byAgent.slice(0, modelLimit), [
      { width: 20, align: 'left',  get: r => pc.white(r.key) },
      { width: 8,  align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 6,  align: 'left',  get: r => pc.dim('runs') },
    ]));
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  lines.push('');
  lines.push('  ' + pc.dim(hrule(W - 4)));
  lines.push('  ' + pc.dim('Privacy: metadata only · no raw prompts or transcripts'));
  lines.push('  ' + pc.dim('Costs are estimates when provider prices are unknown.'));
  lines.push('');

  return lines.join('\n');
}

export async function printTakomiStats(options = {}) {
  const stats = await collectTakomiStats(options);
  if (options.json) console.log(JSON.stringify(stats, null, 2)); else console.log(renderTakomiStats(stats, options));
}

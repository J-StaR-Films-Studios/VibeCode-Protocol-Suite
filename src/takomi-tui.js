import readline from 'node:readline';
import pc from 'picocolors';
import {
  renderTakomiStats,
  renderProfileCard,
  renderHighlights,
  renderSignals,
  heatmapGrid,
  calcStreaks,
  sectionTitle,
  cleanProjectName,
  sessionDuration,
  fmtTokens,
  fmtMoney,
  fmtPercent,
  ms,
  getSessionTurns,
} from './takomi-stats.js';

// ANSI terminal helpers
const ESC = '\x1b';
const ENTER_ALT_SCREEN = `${ESC}[?1049h`;
const EXIT_ALT_SCREEN = `${ESC}[?1049l`;
const HIDE_CURSOR = `${ESC}[?25l`;
const SHOW_CURSOR = `${ESC}[?25h`;
const CLEAR_SCREEN = `${ESC}[2J${ESC}[H`;

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\u001b\[[0-9;]*m/g;
function stripAnsi(str) {
  return String(str || '').replace(ANSI_REGEX, '');
}
function visLen(str) {
  return stripAnsi(str).length;
}
function padEnd(str, width) {
  const len = visLen(str);
  return str + ' '.repeat(Math.max(0, width - len));
}
function padStart(str, width) {
  const len = visLen(str);
  return ' '.repeat(Math.max(0, width - len)) + str;
}
function truncate(str, width) {
  const s = String(str || '');
  if (visLen(s) <= width) return s;
  return s.slice(0, Math.max(0, width - 1)) + '…';
}

function shortDay(str) {
  if (!str) return '??-??';
  const m = String(str).match(/\d{4}-(\d{2}-\d{2})/);
  if (m) return m[1];
  return str.slice(5, 10) || str;
}

// Sparkline volume chart for daily usage
function renderAsciiBars(byDay, metric = 'tokens', width = 50, height = 5) {
  const sortedDays = [...(byDay || [])].sort((a, b) => a.key.localeCompare(b.key));
  const recentDays = sortedDays.slice(-Math.min(width, 30));
  if (!recentDays.length) return ['    No activity recorded'];

  const values = recentDays.map(d => (metric === 'cost' ? (d.cost || 0) : (d.total || 0)));
  const max = Math.max(1, ...values);
  const blocks = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  const lines = [];
  const valFmt = metric === 'cost' ? fmtMoney : fmtTokens;

  for (let r = height - 1; r >= 0; r--) {
    const label = r === height - 1 ? padStart(valFmt(max), 7) : r === 0 ? padStart(valFmt(0), 7) : '       ';
    let barLine = '    ' + pc.dim(label + ' │ ');
    for (const v of values) {
      if (v <= 0) {
        barLine += pc.gray('·');
      } else {
        const ratio = v / max;
        const charIdx = Math.min(blocks.length - 1, Math.max(1, Math.round(ratio * (blocks.length - 1))));
        if (ratio > (r / height)) {
          barLine += pc.cyan(blocks[charIdx]);
        } else {
          barLine += ' ';
        }
      }
    }
    lines.push(barLine);
  }

  lines.push('            ' + pc.dim('└' + '─'.repeat(values.length + 1)));
  if (recentDays.length >= 2) {
    const firstDate = recentDays[0].key.slice(5);
    const lastDate = recentDays[recentDays.length - 1].key.slice(5);
    const dateLine = '              ' + firstDate + ' '.repeat(Math.max(1, values.length - firstDate.length - lastDate.length)) + lastDate;
    lines.push(pc.dim(dateLine));
  }

  return lines;
}

export function launchTakomiTUI(stats, options = {}) {
  if (!process.stdout.isTTY || options.static || options.plain) {
    console.log(renderTakomiStats(stats, options));
    return;
  }

  let running = true;
  let activeTab = options.watch ? 4 : 0; // 0=Overview, 1=Projects, 2=Sessions, 3=Models, 4=Watcher
  let overviewMode = 'heatmap'; // 'heatmap' | 'volume'
  let volumeMetric = 'tokens'; // 'tokens' | 'cost'
  let selectedProjectIdx = 0;
  let selectedSessionIdx = 0;
  let selectedTurnIdx = 0;
  let inspectingSession = null;
  let inspectingTurns = [];
  let inspectingLoading = false;
  let watcherTimer = null;

  function cleanupAndExit(code = 0, printStatic = false) {
    running = false;
    if (watcherTimer) clearInterval(watcherTimer);
    try {
      process.stdout.write(SHOW_CURSOR);
      process.stdout.write(EXIT_ALT_SCREEN);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }
    } catch {}
    if (printStatic) {
      console.log(renderTakomiStats(stats, options));
    }
    process.exit(code);
  }

  process.on('SIGINT', () => cleanupAndExit(0));
  process.on('SIGTERM', () => cleanupAndExit(0));
  process.stdout.on('resize', () => { if (running) render(); });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
  }

  function startWatcher() {
    if (watcherTimer) clearInterval(watcherTimer);
    watcherTimer = setInterval(() => {
      if (activeTab === 4 && running) render();
    }, 1000);
  }

  async function inspectSession(session) {
    if (!session || !session.file) return;
    inspectingSession = session;
    inspectingLoading = true;
    selectedTurnIdx = 0;
    render();
    try {
      inspectingTurns = await getSessionTurns(session.file, options.discounts || []);
    } catch {
      inspectingTurns = [];
    } finally {
      inspectingLoading = false;
      render();
    }
  }

  function render() {
    if (!running) return;
    const W = Math.min(process.stdout.columns || 80, 88);
    const lines = [''];

    // Top Profile Card
    const topModel = stats.byModel[0]?.key || 'unknown';
    const peak = stats.byDay.reduce((a, b) => (b.total > (a?.total || 0) ? b : a), null);
    const streaks = calcStreaks(stats.byDay);
    const cacheRatio = stats.totals.total ? stats.totals.cache / stats.totals.total : 0;
    lines.push(renderProfileCard(stats, { width: W, topModel, peak, streaks, cacheRatio }));

    // Tab Navigation Bar
    const tabs = [
      { id: 0, label: '1 Overview' },
      { id: 1, label: '2 Projects' },
      { id: 2, label: '3 Sessions' },
      { id: 3, label: '4 Models & Months' },
      { id: 4, label: '5 Watcher' },
    ];
    const tabHeaders = tabs.map((t, idx) => {
      const isAct = idx === activeTab;
      return isAct ? pc.bold(pc.bgCyan(pc.black(` [${t.label}] `))) : pc.dim(` [${t.label}] `);
    }).join('  ');
    lines.push('');
    lines.push('  ' + tabHeaders);
    lines.push('  ' + pc.dim('─'.repeat(W - 4)));

    // Active Tab Content
    if (activeTab === 0) {
      renderOverviewTab(lines, W, { peak, cacheRatio });
    } else if (activeTab === 1) {
      renderProjectsTab(lines, W);
    } else if (activeTab === 2) {
      renderSessionsTab(lines, W);
    } else if (activeTab === 3) {
      renderModelsTab(lines, W);
    } else if (activeTab === 4) {
      renderWatcherTab(lines, W);
    }

    // Command Footer
    lines.push('');
    lines.push('  ' + pc.dim('─'.repeat(W - 4)));
    let footer = '[1-5] Tabs   [↑/↓] Navigate   [Enter] Inspect   [s] Static view   [q] Quit';
    if (activeTab === 0) {
      footer = '[1-5] Tabs   [v] Heatmap/Volume toggle   [m] Metric (tokens/cost)   [s] Static view   [q] Quit';
    } else if (activeTab === 1) {
      footer = '[1-5] Tabs   [↑/↓] Select project   [Enter] Inspect top session   [q] Quit';
    } else if (activeTab === 2 && inspectingSession) {
      footer = '[↑/↓] Select turn   [Esc] Back to sessions   [q] Quit';
    } else if (activeTab === 4) {
      footer = '[1-5] Tabs   Monitoring active turn in real time   [q] Quit';
    }
    lines.push('  ' + pc.dim(footer));

    // Output frame
    process.stdout.write(CLEAR_SCREEN + lines.join('\n'));
  }

  // ── Tab 0: Overview ───────────────────────────────────────────────────────
  function renderOverviewTab(lines, W, { peak, cacheRatio }) {
    if (overviewMode === 'heatmap') {
      lines.push('');
      lines.push(sectionTitle('Activity (last 26 weeks)', W));
      lines.push(heatmapGrid(stats.byDay));
    } else {
      lines.push('');
      lines.push(sectionTitle(`Daily usage (last 30 days): ${volumeMetric}`, W));
      const barLines = renderAsciiBars(stats.byDay, volumeMetric, W - 14, 5);
      for (const bl of barLines) {
        lines.push(bl);
      }
    }

    const longestSession = stats.topSessions[0] || null;
    const longestTask = stats.topTasks?.[0] || null;
    lines.push('');
    lines.push(renderHighlights(stats, { peak, longestSession, longestTask, cacheRatio }));

    const signals = renderSignals(stats);
    if (signals) {
      lines.push('');
      lines.push(signals);
    }
  }

  // ── Tab 1: Projects (Clean Two-Column Dossier) ─────────────────────────────
  function renderProjectsTab(lines, W) {
    const projects = stats.byProject || [];
    const selectedProj = projects[selectedProjectIdx] || null;
    const leftW = 38;
    const rightW = Math.max(30, W - leftW - 6);

    lines.push('');
    lines.push(sectionTitle(`Projects catalog (${projects.length} recorded)`, W));

    const maxRows = 10;
    for (let i = 0; i < maxRows; i++) {
      let leftCell = '';
      if (i < projects.length) {
        const p = projects[i];
        const isSel = i === selectedProjectIdx;
        const prefix = isSel ? pc.cyan('> ') : '  ';
        const num = padStart(String(i + 1), 2) + '. ';
        const name = cleanProjectName(p.key, 20);
        const costStr = fmtMoney(p.cost);
        leftCell = `${prefix}${pc.dim(num)}${isSel ? pc.bold(pc.white(padEnd(name, 20))) : pc.white(padEnd(name, 20))} ${pc.yellow(padStart(costStr, 7))}`;
      } else {
        leftCell = ' '.repeat(leftW);
      }

      let rightCell = '';
      if (selectedProj) {
        if (i === 0) {
          rightCell = pc.bold(pc.white('Dossier: ' + cleanProjectName(selectedProj.key, rightW - 10)));
        } else if (i === 1) {
          rightCell = `${pc.dim('Spend:')} ${pc.yellow(fmtMoney(selectedProj.cost))}   ${pc.dim('Tokens:')} ${pc.cyan(fmtTokens(selectedProj.total))}`;
        } else if (i === 2) {
          rightCell = `${pc.dim('Sessions:')} ${pc.white(String(selectedProj.sessions_count || 1))}   ${pc.dim('Events:')} ${pc.white(String(selectedProj.events || 0))}`;
        } else if (i === 3) {
          rightCell = pc.dim('Top sessions in project:');
        } else if (i >= 4 && i <= 8) {
          const pSessions = (stats.sessionRows || []).filter(s => s.project === selectedProj.key).slice(0, 5);
          const sIdx = i - 4;
          if (sIdx < pSessions.length) {
            const s = pSessions[sIdx];
            rightCell = `  ${pc.dim(String(sIdx + 1) + '.')} ${truncate(s.session, 16)}  ${pc.cyan(ms(s.activeMs || 0))}  ${pc.yellow(fmtMoney(s.cost || 0))}`;
          }
        } else if (i === 9) {
          rightCell = pc.dim('Press Enter to inspect top session');
        }
      }

      lines.push(`    ${padEnd(leftCell, leftW)}   ${pc.dim('│')}  ${rightCell}`);
    }
  }

  // ── Tab 2: Sessions (Turn Ledger Inspector) ────────────────────────────────
  function renderSessionsTab(lines, W) {
    if (inspectingSession) {
      renderSessionInspector(lines, W);
      return;
    }

    const sessions = stats.sessionRows || [];
    lines.push('');
    lines.push(sectionTitle(`Sessions ledger (${sessions.length} recorded runs)`, W));
    lines.push(`    #   ${padEnd('Date', 7)} ${padEnd('Session ID', 20)} ${padEnd('Project', 22)} ${padStart('Duration', 9)} ${padStart('Turns', 6)} ${padStart('Tokens', 8)} ${padStart('Cost', 7)}`);
    lines.push('  ' + pc.dim('─'.repeat(W - 4)));

    const maxRows = 10;
    const startIdx = Math.max(0, Math.min(selectedSessionIdx - Math.floor(maxRows / 2), sessions.length - maxRows));
    for (let i = 0; i < maxRows; i++) {
      const idx = startIdx + i;
      if (idx >= sessions.length) {
        lines.push('');
        continue;
      }
      const s = sessions[idx];
      const isSel = idx === selectedSessionIdx;
      const numStr = padStart(String(idx + 1), 3);
      const day = shortDay(s.start || s.end);
      const sid = truncate(s.session, 20);
      const proj = cleanProjectName(s.project || 'general', 22);
      const dur = padStart(ms(sessionDuration(s)), 9);
      const turns = padStart(String(s.turns || 0), 6);
      const tokens = padStart(fmtTokens(s.total || 0), 8);
      const cost = padStart(fmtMoney(s.cost || 0), 7);

      const prefix = isSel ? pc.cyan('> ') : '  ';
      const rowContent = `${numStr}  ${pc.dim(padEnd(day, 6))} ${padEnd(sid, 20)} ${pc.white(padEnd(proj, 22))} ${pc.cyan(dur)} ${pc.dim(turns)} ${pc.cyan(tokens)} ${pc.yellow(cost)}`;
      if (isSel) {
        lines.push(`  ${prefix}${pc.bold(rowContent)}`);
      } else {
        lines.push(`  ${prefix}${rowContent}`);
      }
    }
  }

  function renderSessionInspector(lines, W) {
    const s = inspectingSession;
    lines.push('');
    lines.push(sectionTitle(`Session inspector: ${truncate(s.session, 30)}`, W));
    lines.push(`    ${pc.dim('Project:')} ${pc.bold(pc.white(cleanProjectName(s.project, 28)))}   ${pc.dim('Spend:')} ${pc.yellow(fmtMoney(s.cost || 0))}   ${pc.dim('Tokens:')} ${pc.cyan(fmtTokens(s.total || 0))}`);
    lines.push('');

    if (inspectingLoading) {
      lines.push(`    ${pc.cyan('Loading session turns...')}`);
      for (let k = 0; k < 8; k++) lines.push('');
      return;
    }

    if (!inspectingTurns.length) {
      lines.push(`    ${pc.dim('No step turns recorded in this session log.')}`);
      for (let k = 0; k < 8; k++) lines.push('');
      return;
    }

    lines.push(`    Turn  ${padEnd('Time', 9)} ${padEnd('Model', 18)} ${padStart('Input', 8)} ${padStart('Cache', 8)} ${padStart('Cost', 7)}  Tools`);
    lines.push('  ' + pc.dim('─'.repeat(W - 4)));

    const maxTurns = 6;
    const startT = Math.max(0, Math.min(selectedTurnIdx - Math.floor(maxTurns / 2), inspectingTurns.length - maxTurns));
    for (let i = 0; i < maxTurns; i++) {
      const idx = startT + i;
      if (idx >= inspectingTurns.length) {
        lines.push('');
        continue;
      }
      const t = inspectingTurns[idx];
      const isSel = idx === selectedTurnIdx;
      const tNum = `#${String(t.turnIndex || idx + 1).padStart(2, '0')}`;
      const timeStr = padEnd((t.start || '').slice(11, 19) || '-', 9);
      const modStr = truncate(t.model || 'unknown', 18);
      const inStr = padStart(fmtTokens(t.input || 0), 8);
      const cacheStr = padStart(fmtTokens(t.cache || 0), 8);
      const costStr = padStart(fmtMoney(t.cost || 0), 7);
      const toolsStr = truncate((t.tools || []).join(', ') || 'none', W - 66);

      const prefix = isSel ? pc.cyan('> ') : '  ';
      const rowStr = `${tNum}  ${timeStr} ${padEnd(modStr, 18)} ${inStr} ${cacheStr} ${costStr}  ${pc.dim(toolsStr)}`;
      if (isSel) {
        lines.push(`  ${prefix}${pc.bold(rowStr)}`);
      } else {
        lines.push(`  ${prefix}${rowStr}`);
      }
    }

    lines.push('');
    lines.push(sectionTitle('Turn detail', W));
    const selTurn = inspectingTurns[selectedTurnIdx] || null;
    if (selTurn) {
      lines.push(`    Turn #${selTurn.turnIndex} · ${pc.cyan(selTurn.model)} · Cost: ${pc.yellow(fmtMoney(selTurn.cost))} · Tools: ${(selTurn.tools || []).join(', ') || 'none'}`);
      lines.push(`    ${pc.dim('Prompt:')} ${pc.white(truncate(selTurn.title || 'User prompt', W - 16))}`);
    } else {
      lines.push('');
      lines.push('');
    }
  }

  // ── Tab 3: Models & Months ────────────────────────────────────────────────
  function renderModelsTab(lines, W) {
    lines.push('');
    lines.push(sectionTitle('Model rates and schedules', W));
    lines.push(`    ${padEnd('Model', 22)} ${padStart('Input/M', 10)} ${padStart('Cache/M', 10)} ${padStart('Output/M', 10)}   ${padEnd('Status', 26)}`);
    lines.push('  ' + pc.dim('─'.repeat(W - 4)));

    const modelRates = [
      { name: 'gemini-3.8-flash', in: '$0.75', cache: '$0.075', out: '$3.75', status: 'Promo until 2027-01-01' },
      { name: 'gpt-6-astra', in: '$10.00', cache: '$1.000', out: '$50.00', status: 'Standard canonical' },
      { name: 'gpt-5.6-terra', in: '$2.00', cache: '$0.200', out: '$12.00', status: 'Price drop post-July 30' },
      { name: 'gpt-5.6-luna', in: '$0.20', cache: '$0.020', out: '$1.20', status: 'Price drop post-July 30' },
    ];
    for (const mr of modelRates) {
      const line = `    ${padEnd(mr.name, 22)} ${padStart(mr.in, 10)} ${padStart(mr.cache, 10)} ${padStart(mr.out, 10)}   ${pc.dim(mr.status)}`;
      lines.push(line);
    }

    lines.push('');
    lines.push(sectionTitle('Monthly audit summary', W));
    lines.push(`    ${padEnd('Month', 12)} ${padStart('Tokens', 10)} ${padStart('Est. Cost', 12)} ${padStart('Discount', 12)} ${padStart('Calls', 10)}`);
    lines.push('  ' + pc.dim('─'.repeat(W - 4)));

    const months = stats.byMonth || [];
    for (const m of months.slice(-5).reverse()) {
      const row = `    ${padEnd(m.key, 12)} ${pc.cyan(padStart(fmtTokens(m.total), 10))} ${pc.yellow(padStart(fmtMoney(m.cost), 12))} ${pc.dim(padStart('-', 12))} ${pc.white(padStart(String(m.events), 10))}`;
      lines.push(row);
    }
  }

  // ── Tab 4: Watcher ────────────────────────────────────────────────────────
  function renderWatcherTab(lines, W) {
    const recentSession = stats.sessionRows?.[0] || null;
    lines.push('');
    lines.push(sectionTitle('Active session watcher', W));
    lines.push(`    ${pc.green('●')} ${pc.bold('Status:')} Live (polling every 1s)`);
    lines.push('');
    lines.push(`    ${pc.dim('Active project:')}  ${pc.bold(pc.white(cleanProjectName(recentSession?.project || 'General', 40)))}`);
    lines.push(`    ${pc.dim('Session ID:')}      ${recentSession?.session || 'No active run detected'}`);
    lines.push(`    ${pc.dim('Duration:')}        ${ms(recentSession?.activeMs || 0)} · ${recentSession?.turns || 0} turns · ${recentSession?.toolCalls || 0} tool calls`);
    lines.push(`    ${pc.dim('Token burn:')}      ${pc.cyan(fmtTokens(recentSession?.total || 0))} tokens · ${pc.yellow(fmtMoney(recentSession?.cost || 0))} est. spend`);
    lines.push('');
    lines.push(sectionTitle('Recent tool activity', W));
    const recentTasks = (stats.topTasks || []).slice(0, 4);
    if (!recentTasks.length) {
      lines.push(`    ${pc.dim('No recent tool runs captured')}`);
    } else {
      for (const rt of recentTasks) {
        const taskLine = `    ▶ ${pc.cyan(rt.provider || 'agent')} ${pc.dim(rt.toolCalls + ' tools')} · ${truncate(rt.title || 'tool step', W - 32)}`;
        lines.push(taskLine);
      }
    }
  }

  // ── Keyboard Interaction Loop ─────────────────────────────────────────────
  process.stdin.on('keypress', (str, key) => {
    if (!key) return;

    if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
      cleanupAndExit(0);
      return;
    }

    if (key.name === 's') {
      cleanupAndExit(0, true);
      return;
    }

    if (['1', '2', '3', '4', '5'].includes(key.name)) {
      activeTab = parseInt(key.name, 10) - 1;
      inspectingSession = null;
      if (activeTab === 4) startWatcher(); else if (watcherTimer) clearInterval(watcherTimer);
      render();
      return;
    }

    if (key.name === 'tab') {
      activeTab = (activeTab + 1) % 5;
      inspectingSession = null;
      if (activeTab === 4) startWatcher(); else if (watcherTimer) clearInterval(watcherTimer);
      render();
      return;
    }

    if (activeTab === 0) {
      if (key.name === 'v') {
        overviewMode = overviewMode === 'heatmap' ? 'volume' : 'heatmap';
        render();
        return;
      }
      if (key.name === 'm') {
        volumeMetric = volumeMetric === 'tokens' ? 'cost' : 'tokens';
        render();
        return;
      }
    }

    if (activeTab === 1) {
      const pCount = (stats.byProject || []).length;
      if (key.name === 'up' || key.name === 'k') {
        selectedProjectIdx = Math.max(0, selectedProjectIdx - 1);
        render();
        return;
      }
      if (key.name === 'down' || key.name === 'j') {
        selectedProjectIdx = Math.min(pCount - 1, selectedProjectIdx + 1);
        render();
        return;
      }
      if (key.name === 'return') {
        const curP = stats.byProject[selectedProjectIdx];
        const matchingSession = (stats.sessionRows || []).find(s => s.project === curP?.key);
        if (matchingSession) {
          activeTab = 2;
          inspectSession(matchingSession);
        }
        return;
      }
    }

    if (activeTab === 2) {
      if (inspectingSession) {
        if (key.name === 'escape') {
          inspectingSession = null;
          render();
          return;
        }
        if (key.name === 'up' || key.name === 'k') {
          selectedTurnIdx = Math.max(0, selectedTurnIdx - 1);
          render();
          return;
        }
        if (key.name === 'down' || key.name === 'j') {
          selectedTurnIdx = Math.min(inspectingTurns.length - 1, selectedTurnIdx + 1);
          render();
          return;
        }
      } else {
        const sCount = (stats.sessionRows || []).length;
        if (key.name === 'up' || key.name === 'k') {
          selectedSessionIdx = Math.max(0, selectedSessionIdx - 1);
          render();
          return;
        }
        if (key.name === 'down' || key.name === 'j') {
          selectedSessionIdx = Math.min(sCount - 1, selectedSessionIdx + 1);
          render();
          return;
        }
        if (key.name === 'return') {
          const s = stats.sessionRows?.[selectedSessionIdx];
          if (s) inspectSession(s);
          return;
        }
      }
    }
  });

  if (activeTab === 4) startWatcher();
  render();
}

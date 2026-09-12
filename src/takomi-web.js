import http from 'node:http';
import { exec } from 'node:child_process';
import os from 'node:os';
import pc from 'picocolors';

export function startTakomiWebServer(stats, port = 8766, opts = {}) {
  const openBrowser = opts.open !== false;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/data') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Takomi Stats — Agent Telemetry</title>
  <style>
    :root {
      --bg: #0d0f17;
      --card: #151824;
      --border: #232738;
      --text: #f0f3fa;
      --muted: #8b949e;
      --accent: #d946ef;
      --cyan: #38bdf8;
      --emerald: #34d399;
      --amber: #fbbf24;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.5; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    .brand { font-size: 20px; font-weight: 700; color: var(--accent); }
    .badge { background: #232738; padding: 4px 10px; border-radius: 9999px; font-size: 12px; color: var(--muted); }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 18px; }
    .kpi-val { font-size: 28px; font-weight: 700; }
    .kpi-lbl { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .section-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--text); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--muted); font-weight: 500; }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .text-right { text-align: right; }
    .cyan { color: var(--cyan); }
    .amber { color: var(--amber); }
    .emerald { color: var(--emerald); }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Takomi Stats <span class="badge">Agent Telemetry</span></div>
    <div class="badge">Generated: ${new Date(stats.generatedAt).toLocaleString()}</div>
  </div>

  <div class="kpi-grid">
    <div class="card">
      <div class="kpi-val cyan">${Number(stats.totals.total || 0).toLocaleString()}</div>
      <div class="kpi-lbl">Total Processed Tokens</div>
    </div>
    <div class="card">
      <div class="kpi-val emerald">${Math.round(((stats.totals.cache || 0) / (stats.totals.total || 1)) * 100)}%</div>
      <div class="kpi-lbl">Prompt Cache Hit Rate</div>
    </div>
    <div class="card">
      <div class="kpi-val amber">$${Number(stats.totals.cost || 0).toFixed(2)}</div>
      <div class="kpi-lbl">Estimated Total Spend</div>
    </div>
    <div class="card">
      <div class="kpi-val">${stats.sessions || 0}</div>
      <div class="kpi-lbl">Total Agent Sessions</div>
    </div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
    <div class="card">
      <div class="section-title">Top Projects</div>
      <table>
        <thead>
          <tr><th>Project</th><th class="text-right">Tokens</th><th class="text-right">Cost</th></tr>
        </thead>
        <tbody>
          ${(stats.byProject || []).slice(0, 8).map(p => `
            <tr>
              <td><b>${p.key}</b></td>
              <td class="text-right cyan">${Number(p.total || 0).toLocaleString()}</td>
              <td class="text-right amber">$${Number(p.cost || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="section-title">Top Models</div>
      <table>
        <thead>
          <tr><th>Model</th><th class="text-right">Tokens</th><th class="text-right">Cost</th></tr>
        </thead>
        <tbody>
          ${(stats.byModel || []).slice(0, 8).map(m => `
            <tr>
              <td><b>${m.key}</b></td>
              <td class="text-right cyan">${Number(m.total || 0).toLocaleString()}</td>
              <td class="text-right amber">$${Number(m.cost || 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card">
    <div class="section-title">Recent Sessions & Turns</div>
    <table>
      <thead>
        <tr><th>Session</th><th>Project</th><th class="text-right">Turns</th><th class="text-right">Tools</th><th class="text-right">Tokens</th><th class="text-right">Cost</th></tr>
      </thead>
      <tbody>
        ${(stats.sessionRows || []).slice(0, 10).map(s => `
          <tr>
            <td>${s.session}</td>
            <td>${s.project || 'general'}</td>
            <td class="text-right">${s.turns || 0}</td>
            <td class="text-right">${s.toolCalls || 0}</td>
            <td class="text-right cyan">${Number(s.total || 0).toLocaleString()}</td>
            <td class="text-right amber">$${Number(s.cost || 0).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.listen(port, () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`\n${pc.bold(pc.magenta('Takomi Stats Web'))} is running at ${pc.cyan(url)}`);
    console.log(pc.dim('Press Ctrl+C to stop server.\n'));

    // Automatically open the browser unless opted out with --no-open.
    if (openBrowser) {
      const cmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
      exec(cmd, () => {});
    }
  });
}

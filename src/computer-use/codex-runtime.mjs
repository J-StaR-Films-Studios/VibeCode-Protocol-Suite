import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';

export function findCodexCli({ cliPath, env = process.env, node = process.execPath } = {}) {
  const candidates = cliPath ? [cliPath] : (env.PATH || '').split(path.delimiter)
    .filter(Boolean).flatMap(dir => [path.join(dir, 'codex.exe'), path.join(dir, 'codex.cmd')]);
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    if (/\.(exe|com)$/i.test(candidate)) return { command: candidate, args: [] };
    const script = /\.js$/i.test(candidate) ? candidate
      : path.join(path.dirname(candidate), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(script)) return { command: node, args: [script] };
  }
  throw new Error('Codex CLI was not found. Install Codex and add it to PATH, or provide --codex-cli with its .exe or codex.js path.');
}

export function readCodexRuntime({ cliPath, home = homedir(), env = process.env, run = execFileSync } = {}) {
  const cli = findCodexCli({ cliPath, env });
  let config;
  try {
    config = JSON.parse(run(cli.command, [...cli.args, 'mcp', 'get', 'node_repl', '--json'], {
      cwd: home, env, encoding: 'utf8', timeout: 20000, windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
  } catch {
    throw new Error('Cannot read Codex node_repl registration. Open Codex and check that its desktop plugin is enabled.');
  }
  const transport = config.transport;
  if (!config.enabled || transport?.type !== 'stdio' || typeof transport.command !== 'string' ||
      !existsSync(transport.command) || !Array.isArray(transport.args) ||
      !transport.args.every(arg => typeof arg === 'string') ||
      !transport.env || typeof transport.env !== 'object' || Array.isArray(transport.env) ||
      !Object.values(transport.env).every(value => typeof value === 'string')) {
    throw new Error('Codex node_repl registration is disabled, invalid, or points at a missing runtime.');
  }
  const plugin = path.join(transport.env.CODEX_HOME || path.join(home, '.codex'),
    'plugins', 'cache', 'openai-bundled', 'computer-use', transport.env.BROWSER_USE_CODEX_APP_VERSION || '');
  let guidance;
  try {
    guidance = ['skills/computer-use/SKILL.md', 'docs/guidance.md', 'docs/api.md', 'docs/confirmations.md']
      .map(file => readFileSync(path.join(plugin, file), 'utf8')).join('\n\n');
  } catch {
    throw new Error('Matching Codex computer-use guidance is missing. Open or update Codex, then reconnect.');
  }
  return { command: transport.command, args: transport.args, cwd: transport.cwd || home,
    env: { ...env, ...transport.env, NODE_REPL_TRUSTED_SERVICES: JSON.stringify({ sky: '@oai/sky/service' }) },
    instructions: guidance };
}

export const DESKTOP_USAGE = 'Windows desktop control using the user\'s Codex runtime. Keep Codex open and the desktop unlocked. '
  + 'Only one agent may send desktop input at a time. Read the full instructions before acting. '
  + 'Initialize globalThis.sky = (await import("@oai/sky")).sky; discover windows with sky.list_windows(). '
  + 'Use returned window objects and refresh observations after each action. Never automate terminals, authentication, '
  + 'password managers, security/privacy settings, or the Codex UI. Follow the bundled confirmation policy. '
  + 'This shared launcher exposes desktop services only, not the Codex browser service.';

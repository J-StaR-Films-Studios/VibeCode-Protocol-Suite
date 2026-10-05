import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

export function computerUsePaths(home = homedir()) {
  const agent = path.join(home, '.pi', 'agent');
  return { home, config: path.join(agent, 'takomi', 'computer-use.json'),
    approvals: path.join(agent, 'takomi', 'computer-use-approvals.json'),
    mcp: path.join(agent, 'mcp.json'),
    launcher: path.join(home, '.mcp', 'servers', 'takomi-computer-use', 'server.mjs') };
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function loadComputerUseConfig(file) {
  let value;
  try { value = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return null;
    throw new Error('Cannot read computer-use configuration. Existing data was not changed.');
  }
  if (!isRecord(value) || value.version !== 1 || typeof value.enabled !== 'boolean' || !isRecord(value.source)) {
    throw new Error('Invalid computer-use configuration. Run takomi setup computer-use.');
  }
  const source = value.source;
  if (source.kind === 'existing' && typeof source.name === 'string' && source.name.length > 0) {
    return { version: 1, enabled: value.enabled, source: { kind: 'existing', name: source.name } };
  }
  if (source.kind === 'codex' && (source.cliPath === undefined || typeof source.cliPath === 'string')) {
    return { version: 1, enabled: value.enabled, source: { kind: 'codex', ...(source.cliPath ? { cliPath: source.cliPath } : {}) } };
  }
  throw new Error('Invalid computer-use server selection.');
}

export function parseDesktopServer(value, name, home, environment = process.env) {
  if (!isRecord(value) || value.enabled === false || typeof value.command !== 'string' || !value.command ||
      (value.type !== undefined && value.type !== 'stdio') ||
      (value.args !== undefined && (!Array.isArray(value.args) || !value.args.every(arg => typeof arg === 'string'))) ||
      (value.cwd !== undefined && typeof value.cwd !== 'string')) throw new Error(`Invalid or disabled stdio server: ${name}`);
  const expandHome = text => text.startsWith('~/') || text.startsWith('~\\') ? path.join(home, text.slice(2)) : text;
  const env = {};
  if (value.env !== undefined) {
    if (!isRecord(value.env)) throw new Error(`Invalid environment for server: ${name}`);
    for (const [key, text] of Object.entries(value.env)) {
      if (typeof text !== 'string' || text.startsWith('!')) throw new Error('Only string environment values and ${NAME} substitutions are supported.');
      env[key] = text.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, variable) => {
        const resolved = environment[variable];
        if (resolved === undefined) throw new Error(`Missing environment variable: ${variable}`);
        return resolved;
      });
    }
  }
  const command = expandHome(value.command);
  const args = Array.isArray(value.args) ? value.args.map(expandHome) : [];
  const cwd = path.resolve(home, expandHome(value.cwd ?? '.'));
  // Changed registrations require new app consent. Hash environment values instead of storing them in grants.
  const id = createHash('sha256').update(JSON.stringify({ name, command, args, cwd, env })).digest('hex');
  return { name, command, args, cwd, env, id };
}

export async function resolveDesktopServer(config, home = homedir()) {
  const paths = computerUsePaths(home);
  if (config.source.kind === 'codex') return parseDesktopServer({ command: process.execPath,
    args: [paths.launcher, ...(config.source.cliPath ? ['--codex-cli', config.source.cliPath] : [])] }, 'takomi-codex-desktop', home);
  let registry;
  try { registry = JSON.parse(await readFile(paths.mcp, 'utf8')); }
  catch { throw new Error('Cannot read the user-level MCP registry.'); }
  if (!isRecord(registry) || !isRecord(registry.mcpServers)) throw new Error('No user-level MCP registrations found.');
  return parseDesktopServer(registry.mcpServers[config.source.name], config.source.name, home);
}

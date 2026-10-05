import fs from 'fs-extra';
import path from 'node:path';
import os from 'node:os';
import prompts from 'prompts';
import { PATHS } from '../utils.js';
import { runCommand } from '../pi-harness.js';
import { copyOwnedTree } from '../owned-tree.js';
import { computerUsePaths, loadComputerUseConfig, parseDesktopServer, resolveDesktopServer } from '../../.pi/extensions/takomi-computer-use/config.js';
import { readCodexRuntime } from './codex-runtime.mjs';

export async function existingDesktopServers(home = os.homedir()) {
  const file = computerUsePaths(home).mcp;
  if (!await fs.pathExists(file)) return [];
  let registry;
  try { registry = await fs.readJson(file); }
  catch { throw new Error('Invalid user MCP registry. It was not changed.'); }
  if (!registry || typeof registry !== 'object' || !registry.mcpServers || typeof registry.mcpServers !== 'object' || Array.isArray(registry.mcpServers)) throw new Error('Invalid user MCP registry. It was not changed.');
  const servers = [];
  for (const [name, value] of Object.entries(registry.mcpServers)) {
    try { servers.push(parseDesktopServer(value, name, home)); } catch { /* Non-stdio registrations are not candidates. */ }
  }
  return servers;
}

export async function probeDesktopServer(server) {
  const { McpClient, StdioTransport } = await import('@earendil-works/pi-mcp');
  const client = new McpClient({ name: 'takomi-computer-use-doctor', version: '1.0.0', requestTimeoutMs: 45000,
    capabilities: { elicitation: { form: {} } } });
  // A diagnostic never grants access to an app.
  client.setRequestHandler('elicitation/create', () => ({ action: 'cancel' }));
  try {
    await client.connect(new StdioTransport({ ...server, stderr: 'pipe' }));
    const tools = await client.listTools();
    if (!tools.some(tool => tool.name === 'js')) throw new Error('The selected MCP does not expose a js desktop tool.');
    const result = await client.callTool('js', { title: 'Read-only desktop connection check', timeout_ms: 30000,
      code: 'globalThis.sky = (await import("@oai/sky")).sky; nodeRepl.write(JSON.stringify({windowCount:(await sky.list_windows()).length}));' });
    if (result.isError) throw new Error('Desktop inventory failed. Keep Codex open and the desktop unlocked.');
    const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
    const inventory = JSON.parse(text);
    if (!Number.isInteger(inventory.windowCount) || inventory.windowCount < 0) throw new Error('The server did not return a desktop inventory.');
    return { ok: true, tools: tools.length, windowCount: inventory.windowCount };
  } catch {
    throw new Error('Desktop MCP inventory check failed. Check that the selected server supports js and that Codex is open with Windows unlocked. No approvals were granted.');
  } finally { await client.close(); }
}

async function installClientDependencies(directory) {
  const result = runCommand('npm', ['install', '--prefix', directory, '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund']);
  if (result.status !== 0) throw new Error('Could not install the pinned desktop client dependencies. Existing configuration was left unchanged.');
}

async function prepareManagedDirectory(directory) {
  if (await fs.pathExists(directory)) {
    const stat = await fs.lstat(directory);
    if (stat.isSymbolicLink()) throw new Error(`Refusing to replace a linked directory: ${directory}`);
    const marker = path.join(directory, '.takomi-computer-use.json');
    // The normal Pi asset installer also copies this extension before it is enabled.
    const pkg = await fs.readJson(path.join(directory, 'package.json')).catch(() => null);
    if (!await fs.pathExists(marker) && pkg?.name !== 'takomi-computer-use') throw new Error(`Directory is not owned by this feature: ${directory}`);
  } else await fs.ensureDir(directory);
}

export async function installComputerUse({ home = os.homedir(), source, platform = process.platform,
  installDependencies = installClientDependencies, probe = probeDesktopServer, codexProbe = readCodexRuntime } = {}) {
  if (platform !== 'win32') throw new Error('Takomi computer use currently supports Windows only. No files were changed.');
  const paths = computerUsePaths(home);
  const config = { version: 1, enabled: true, source };
  await loadComputerUseConfig(paths.config);
  let server;
  if (source?.kind === 'existing') server = await resolveDesktopServer(config, home);
  else if (source?.kind === 'codex') {
    codexProbe({ cliPath: source.cliPath, home });
    server = parseDesktopServer({ command: process.execPath, args: [path.join(PATHS.root, 'src', 'computer-use', 'server.mjs'),
      ...(source.cliPath ? ['--codex-cli', source.cliPath] : [])] }, 'takomi-codex-desktop', home);
  } else throw new Error('Choose a compatible existing server or the Codex desktop launcher.');
  const diagnostic = await probe(server);
  if (!diagnostic.ok) throw new Error('Desktop MCP check failed. No setup was enabled.');
  const launcherRoot = path.dirname(paths.launcher);
  const extensionRoot = path.join(home, '.pi', 'agent', 'extensions', 'takomi-computer-use');
  await prepareManagedDirectory(launcherRoot);
  await prepareManagedDirectory(extensionRoot);
  for (const file of ['server.mjs', 'codex-runtime.mjs']) await fs.copy(path.join(PATHS.root, 'src', 'computer-use', file), path.join(launcherRoot, file));
  await copyOwnedTree(path.join(PATHS.pi, 'extensions', 'takomi-computer-use'), extensionRoot, {
    filter: file => !path.relative(path.join(PATHS.pi, 'extensions', 'takomi-computer-use'), file).split(path.sep).includes('node_modules'),
  });
  for (const directory of [launcherRoot, extensionRoot]) await fs.writeJson(path.join(directory, '.takomi-computer-use.json'), { owner: 'takomi-computer-use', version: 1 }, { spaces: 2 });
  await installDependencies(extensionRoot);
  await fs.ensureDir(path.dirname(paths.config));
  if (await fs.pathExists(paths.config)) {
    await fs.copy(paths.config, `${paths.config}.backup-${Date.now()}`, { overwrite: false });
  }
  await fs.writeJson(paths.config, config, { spaces: 2 });
  return { ok: true, changed: true, report: `Computer use enabled. Restart Pi. Configuration: ${paths.config}`, diagnostic };
}

export async function setupComputerUse(options = {}) {
  const home = options.home ?? os.homedir();
  if (process.platform !== 'win32') throw new Error('Takomi computer use currently supports Windows only.');
  const interactive = options.interactive ?? (process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive && !options.yes) throw new Error('Use an interactive terminal, or pass --yes with --server or the Codex launcher.');
  const candidates = await existingDesktopServers(home);
  let source;
  if (options.server) {
    if (!candidates.some(server => server.name === options.server)) throw new Error('The selected user-level stdio MCP server was not found or is disabled.');
    source = { kind: 'existing', name: options.server };
  } else if (interactive) {
    const response = await prompts({ type: 'select', name: 'source', message: 'Desktop MCP to use?',
      choices: [...candidates.filter(server => /computer|desktop|node_repl|cua_repl/i.test(server.name)).map(server => ({
        title: `Use existing MCP: ${server.name}`, value: server.name,
      })), { title: 'Use my installed Codex desktop runtime', value: null }] });
    if (response.source === undefined) return { ok: true, changed: false, report: 'Computer-use setup cancelled.' };
    source = response.source === null ? { kind: 'codex', ...(options.codexCli ? { cliPath: options.codexCli } : {}) }
      : { kind: 'existing', name: response.source };
  } else source = { kind: 'codex', ...(options.codexCli ? { cliPath: options.codexCli } : {}) };
  if (interactive && !options.yes) {
    const consent = await prompts({ type: 'confirm', name: 'install', initial: false,
      message: 'Install the optional desktop client and enable it for Pi? Codex and existing MCP registrations stay unchanged.' });
    if (consent.install !== true) return { ok: true, changed: false, report: 'Computer-use setup cancelled.' };
  }
  return installComputerUse({ home, source });
}

export async function computerUseDoctor({ home = os.homedir(), platform = process.platform, probe = probeDesktopServer } = {}) {
  if (platform !== 'win32') return { ok: false, report: 'Windows-only feature.' };
  try {
    const config = await loadComputerUseConfig(computerUsePaths(home).config);
    if (!config?.enabled) return { ok: false, report: 'Computer use is disabled. Run takomi setup computer-use to opt in.' };
    const diagnostic = await probe(await resolveDesktopServer(config, home));
    return { ...diagnostic, report: `Connected. ${diagnostic.tools} tools; ${diagnostic.windowCount} windows detected. No desktop input was sent.` };
  } catch { return { ok: false, report: 'Desktop MCP check failed. Check setup, the selected server, Codex, and the unlocked Windows desktop. No approvals were granted.' }; }
}

export async function disableComputerUse(home = os.homedir()) {
  const paths = computerUsePaths(home);
  const config = await loadComputerUseConfig(paths.config);
  if (!config) return 'Computer use is not configured.';
  await fs.writeJson(paths.config, { ...config, enabled: false }, { spaces: 2 });
  return 'Computer use disabled. Restart Pi. Saved app approvals were preserved.';
}

export async function desktopMcpRegistration(home = os.homedir()) {
  const paths = computerUsePaths(home);
  const config = await loadComputerUseConfig(paths.config);
  const cliPath = config?.source.kind === 'codex' ? config.source.cliPath : undefined;
  return { mcpServers: { 'takomi-computer-use': { command: process.execPath,
    args: [paths.launcher, ...(cliPath ? ['--codex-cli', cliPath] : [])] } } };
}

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { PATHS } from './utils.js';
import { STORE_PATH, MANIFEST_PATH } from './store.js';

const HOME = os.homedir();

function getPathEntries() {
  return (process.env.PATH || '').split(path.delimiter).filter(Boolean);
}

function commandExists(command) {
  const probe = process.platform === 'win32'
    ? spawnSync('where', [command], { stdio: 'pipe', encoding: 'utf8' })
    : spawnSync('which', [command], { stdio: 'pipe', encoding: 'utf8' });

  if (probe.status === 0) {
    const matches = probe.stdout.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    const preferred = process.platform === 'win32'
      ? matches.find((entry) => /\.(cmd|exe|bat)$/i.test(entry))
      : matches[0];
    return { found: true, path: preferred || matches[0] || null };
  }

  for (const entry of getPathEntries()) {
    const candidate = path.join(entry, process.platform === 'win32' ? `${command}.cmd` : command);
    if (fs.existsSync(candidate)) return { found: true, path: candidate };
  }

  return { found: false, path: null };
}

export function getPiAgentRoot(home = HOME) {
  return path.join(home, '.pi', 'agent');
}

export function getPiGlobalTargets(home = HOME) {
  const agentRoot = getPiAgentRoot(home);
  return {
    root: agentRoot,
    extensions: path.join(agentRoot, 'extensions'),
    prompts: path.join(agentRoot, 'prompts'),
    agents: path.join(agentRoot, 'agents'),
    themes: path.join(agentRoot, 'themes'),
    settings: path.join(agentRoot, 'settings.json'),
    takomi: path.join(agentRoot, 'takomi'),
    routingPolicy: path.join(agentRoot, 'takomi', 'model-routing.md'),
  };
}

export function getProjectPiTargets(cwd = process.cwd()) {
  return {
    root: path.join(cwd, '.pi'),
    extensions: path.join(cwd, '.pi', 'extensions'),
    prompts: path.join(cwd, '.pi', 'prompts'),
    agents: path.join(cwd, '.pi', 'agents'),
    themes: path.join(cwd, '.pi', 'themes'),
    settings: path.join(cwd, '.pi', 'settings.json'),
    takomiProfile: path.join(cwd, '.pi', 'takomi-profile.json'),
    routingPolicy: path.join(cwd, '.pi', 'takomi', 'model-routing.md'),
  };
}

export function getBundledPiAssetTargets() {
  const root = path.join(PATHS.root, '.pi');
  return {
    root,
    runtime: path.join(root, 'extensions', 'takomi-runtime'),
    subagents: path.join(root, 'extensions', 'takomi-subagents'),
    prompts: path.join(root, 'prompts'),
    agents: path.join(root, 'agents'),
    themes: path.join(root, 'themes'),
    settings: path.join(root, 'settings.json'),
    routingPolicy: path.join(root, 'takomi', 'model-routing.md'),
    profile: path.join(root, 'takomi-profile.json'),
  };
}

async function getPackageFileEntries() {
  try {
    const pkg = await fs.readJson(PATHS.packageJson);
    return Array.isArray(pkg.files) ? pkg.files : [];
  } catch {
    return [];
  }
}

export async function detectPiCommand() {
  const binary = commandExists('pi');
  if (!binary.found) {
    return { installed: false, path: null, version: null };
  }

  const versionProbe = process.platform === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-Command', `& '${(binary.path || 'pi').replace(/'/g, "''")}' --version`], { stdio: 'pipe', encoding: 'utf8' })
    : spawnSync(binary.path || 'pi', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
  const output = [versionProbe.stdout, versionProbe.stderr].filter(Boolean).join('\n').trim();
  return {
    installed: true,
    path: binary.path,
    version: versionProbe.status === 0 ? (output || null) : null,
  };
}

export async function inspectBundledPiAssets() {
  const targets = getBundledPiAssetTargets();
  const checks = {
    root: await fs.pathExists(targets.root),
    runtime: await fs.pathExists(targets.runtime),
    subagents: await fs.pathExists(targets.subagents),
    prompts: await fs.pathExists(targets.prompts),
    agents: await fs.pathExists(targets.agents),
    themes: await fs.pathExists(targets.themes),
    settings: await fs.pathExists(targets.settings),
    routingPolicy: await fs.pathExists(targets.routingPolicy),
    profile: await fs.pathExists(targets.profile),
  };

  const packageReady = await fs.pathExists(targets.root);
  const packageFiles = await getPackageFileEntries();
  const packageIncluded = packageFiles.includes('.pi') || packageFiles.some((entry) => entry.startsWith('.pi/')) || packageReady;

  return {
    targets,
    checks,
    packageReady,
    packageIncluded,
  };
}

export async function inspectInstalledTakomiPiHarness(home = HOME) {
  const targets = getPiGlobalTargets(home);
  const runtime = path.join(targets.extensions, 'takomi-runtime');
  const subagents = path.join(targets.extensions, 'takomi-subagents');

  return {
    targets,
    runtimeInstalled: await fs.pathExists(runtime),
    subagentsInstalled: await fs.pathExists(subagents),
    promptsInstalled: await fs.pathExists(targets.prompts),
    agentsInstalled: await fs.pathExists(targets.agents),
    themesInstalled: await fs.pathExists(targets.themes),
    settingsPresent: await fs.pathExists(targets.settings),
    routingPolicyPresent: await fs.pathExists(targets.routingPolicy),
    manifestPresent: await fs.pathExists(MANIFEST_PATH),
    storePresent: await fs.pathExists(STORE_PATH),
  };
}

export async function inspectPiHarnessEnvironment(cwd = process.cwd()) {
  const pi = await detectPiCommand();
  const bundled = await inspectBundledPiAssets();
  const installed = await inspectInstalledTakomiPiHarness();
  const project = getProjectPiTargets(cwd);

  return {
    pi,
    bundled,
    installed,
    project: {
      targets: project,
      settingsPresent: await fs.pathExists(project.settings),
      routingPolicyPresent: await fs.pathExists(project.routingPolicy),
      profilePresent: await fs.pathExists(project.takomiProfile),
    },
  };
}

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import pc from 'picocolors';
import { PATHS } from './utils.js';
import { STORE_PATH, MANIFEST_PATH } from './store.js';

const TAKOMI_PACKAGE_DIR = PATHS.root;

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

async function getPackageJson() {
  try {
    return await fs.readJson(PATHS.packageJson);
  } catch {
    return {};
  }
}

async function getPackageFileEntries() {
  const pkg = await getPackageJson();
  return Array.isArray(pkg.files) ? pkg.files : [];
}

function getGlobalNodeModulesRoot(home = HOME) {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'npm', 'node_modules');
  }
  return path.join(home, '.npm-global', 'lib', 'node_modules');
}

export async function inspectPiSubagentsDependency(home = HOME) {
  const pkg = await getPackageJson();
  const declaredVersion = pkg?.dependencies?.['pi-subagents'] || null;
  const localPackageJson = path.join(TAKOMI_PACKAGE_DIR, 'node_modules', 'pi-subagents', 'package.json');
  const globalPackageJson = path.join(getGlobalNodeModulesRoot(home), 'pi-subagents', 'package.json');

  let localVersion = null;
  let globalVersion = null;

  try {
    if (await fs.pathExists(localPackageJson)) {
      const localPkg = await fs.readJson(localPackageJson);
      localVersion = localPkg.version || null;
    }
  } catch {}

  try {
    if (await fs.pathExists(globalPackageJson)) {
      const globalPkg = await fs.readJson(globalPackageJson);
      globalVersion = globalPkg.version || null;
    }
  } catch {}

  const bin = commandExists('pi-subagents');

  return {
    declaredVersion,
    localInstalled: Boolean(localVersion),
    localVersion,
    localPackageJson,
    globalInstalled: Boolean(globalVersion),
    globalVersion,
    globalPackageJson,
    binaryInstalled: bin.found,
    binaryPath: bin.path,
  };
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
  const core = path.join(path.dirname(targets.root), 'src', 'pi-takomi-core');
  const piSubagentsModule = path.join(targets.root, 'node_modules', 'pi-subagents');

  return {
    targets,
    runtimeInstalled: await fs.pathExists(runtime),
    subagentsInstalled: await fs.pathExists(subagents),
    coreInstalled: await fs.pathExists(core),
    piSubagentsModuleInstalled: await fs.pathExists(piSubagentsModule),
    promptsInstalled: await fs.pathExists(targets.prompts),
    agentsInstalled: await fs.pathExists(targets.agents),
    themesInstalled: await fs.pathExists(targets.themes),
    settingsPresent: await fs.pathExists(targets.settings),
    routingPolicyPresent: await fs.pathExists(targets.routingPolicy),
    manifestPresent: await fs.pathExists(MANIFEST_PATH),
    storePresent: await fs.pathExists(STORE_PATH),
  };
}

function runCommand(command, args) {
  return spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' });
}

export async function ensurePiInstalled() {
  const before = await detectPiCommand();
  if (before.installed) {
    return { ok: true, changed: false, report: 'Pi already available.' };
  }

  const attempts = [
    { command: 'npm', args: ['install', '-g', '@mariozechner/pi-coding-agent'] },
    { command: 'npm.cmd', args: ['install', '-g', '@mariozechner/pi-coding-agent'] },
  ];

  let lastError = 'Unknown install failure.';
  for (const attempt of attempts) {
    const result = runCommand(attempt.command, attempt.args);
    if (result.status === 0) {
      const after = await detectPiCommand();
      if (after.installed) {
        return {
          ok: true,
          changed: true,
          report: (result.stdout || result.stderr || 'Installed Pi.').trim(),
        };
      }
      lastError = 'npm install reported success, but pi was still not detected.';
      continue;
    }
    lastError = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || lastError;
  }

  return { ok: false, changed: false, report: lastError };
}

export function printPiInstallResult(result) {
  if (result.ok) {
    console.log(pc.green(`✔ ${result.changed ? 'Installed' : 'Validated'} Pi`));
    if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-4).join('\n')));
    return;
  }
  console.log(pc.red('✗ Failed to install Pi'));
  if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-8).join('\n')));
}

export async function ensurePiSubagentsInstalled() {
  const before = await inspectPiSubagentsDependency();
  if (before.localInstalled || before.globalInstalled) {
    return { ok: true, changed: false, report: 'pi-subagents already available.' };
  }

  const attempts = [
    { command: 'npm', args: ['install', '-g', 'pi-subagents'] },
    { command: 'npm.cmd', args: ['install', '-g', 'pi-subagents'] },
  ];

  let lastError = 'Unknown install failure.';
  for (const attempt of attempts) {
    const result = runCommand(attempt.command, attempt.args);
    if (result.status === 0) {
      const after = await inspectPiSubagentsDependency();
      if (after.localInstalled || after.globalInstalled) {
        return {
          ok: true,
          changed: true,
          report: (result.stdout || result.stderr || 'Installed pi-subagents.').trim(),
        };
      }
      lastError = 'npm install reported success, but pi-subagents was still not detected.';
      continue;
    }
    lastError = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || lastError;
  }

  return { ok: false, changed: false, report: lastError };
}

export function printPiSubagentsInstallResult(result) {
  if (result.ok) {
    console.log(pc.green(`✔ ${result.changed ? 'Installed' : 'Validated'} pi-subagents`));
    if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-4).join('\n')));
    return;
  }
  console.log(pc.red('✗ Failed to install pi-subagents'));
  if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-8).join('\n')));
}

export async function inspectPiHarnessEnvironment(cwd = process.cwd()) {
  const pi = await detectPiCommand();
  const bundled = await inspectBundledPiAssets();
  const installed = await inspectInstalledTakomiPiHarness();
  const piSubagents = await inspectPiSubagentsDependency();
  const project = getProjectPiTargets(cwd);

  return {
    pi,
    bundled,
    installed,
    piSubagents,
    project: {
      targets: project,
      settingsPresent: await fs.pathExists(project.settings),
      routingPolicyPresent: await fs.pathExists(project.routingPolicy),
      profilePresent: await fs.pathExists(project.takomiProfile),
    },
  };
}

export async function launchTakomiHarness(cwd = process.cwd()) {
  const report = await inspectPiHarnessEnvironment(cwd);

  if (!report.pi.installed) {
    console.log(pc.red('Pi is not installed.'));
    console.log(pc.dim('Run: takomi install pi'));
    return 1;
  }

  if (!report.installed.runtimeInstalled || !report.installed.subagentsInstalled) {
    console.log(pc.red('Takomi Pi harness is not fully installed.'));
    console.log(pc.dim('Run: takomi install pi'));
    return 1;
  }

  const env = {
    ...process.env,
    TAKOMI_HARNESS: '1',
  };

  return await new Promise((resolve) => {
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', 'pi'], {
          cwd,
          stdio: 'inherit',
          env,
          shell: false,
        })
      : spawn(report.pi.path || 'pi', [], {
          cwd,
          stdio: 'inherit',
          env,
          shell: false,
        });

    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

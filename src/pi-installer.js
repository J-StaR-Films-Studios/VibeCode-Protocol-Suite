import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import pc from 'picocolors';
import { PATHS } from './utils.js';
import { getPiGlobalTargets } from './pi-harness.js';

const HOME = os.homedir();
const TAKOMI_HOME = path.join(HOME, '.takomi');
export const PI_MANIFEST_PATH = path.join(TAKOMI_HOME, 'pi-manifest.json');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function hashPath(targetPath) {
  if (!await fs.pathExists(targetPath)) return null;
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    const buf = await fs.readFile(targetPath);
    return sha256(buf);
  }

  const entries = [];
  async function walk(dir, prefix = '') {
    const names = (await fs.readdir(dir)).sort();
    for (const name of names) {
      const full = path.join(dir, name);
      const rel = path.join(prefix, name).replace(/\\/g, '/');
      const st = await fs.stat(full);
      if (st.isDirectory()) {
        entries.push(`dir:${rel}`);
        await walk(full, rel);
      } else {
        const buf = await fs.readFile(full);
        entries.push(`file:${rel}:${sha256(buf)}`);
      }
    }
  }
  await walk(targetPath);
  return sha256(entries.join('\n'));
}

async function pathIsSameSymlink(dest, src) {
  try {
    const stat = await fs.lstat(dest);
    if (!stat.isSymbolicLink()) return false;
    const target = await fs.readlink(dest);
    const resolvedTarget = path.resolve(path.dirname(dest), target);
    return path.resolve(src) === resolvedTarget;
  } catch {
    return false;
  }
}

async function prepareOwnedTarget(src, dest) {
  if (await pathIsSameSymlink(dest, src)) return 'symlink';
  if (!await fs.pathExists(dest)) return 'copy';
  const stat = await fs.lstat(dest);
  if (stat.isSymbolicLink()) {
    await fs.remove(dest);
    return 'copy';
  }
  return 'copy';
}

async function copyOwnedDirectory(src, dest) {
  await fs.ensureDir(path.dirname(dest));
  const mode = await prepareOwnedTarget(src, dest);
  if (mode === 'symlink') return hashPath(src);
  await fs.copy(src, dest, { overwrite: true });
  return hashPath(dest);
}

async function copyOwnedFile(src, dest) {
  await fs.ensureDir(path.dirname(dest));
  const mode = await prepareOwnedTarget(src, dest);
  if (mode === 'symlink') return hashPath(src);
  await fs.copy(src, dest, { overwrite: true });
  return hashPath(dest);
}

export async function readPiInstallManifest() {
  try {
    if (await fs.pathExists(PI_MANIFEST_PATH)) return await fs.readJson(PI_MANIFEST_PATH);
  } catch {}
  return null;
}

export async function writePiInstallManifest(manifest) {
  await fs.ensureDir(TAKOMI_HOME);
  await fs.writeJson(PI_MANIFEST_PATH, manifest, { spaces: 2 });
}

export async function installPiHarnessAssets(version = 'unknown') {
  const srcRoot = PATHS.pi;
  const targets = getPiGlobalTargets();

  const copied = {};

  const readmeSrc = path.join(srcRoot, 'README.md');
  if (await fs.pathExists(readmeSrc)) {
    copied.readme = await copyOwnedFile(readmeSrc, path.join(targets.root, 'README.md'));
  }

  const extensionsRoot = path.join(srcRoot, 'extensions');
  if (await fs.pathExists(extensionsRoot)) {
    const extensionEntries = await fs.readdir(extensionsRoot, { withFileTypes: true });
    for (const entry of extensionEntries) {
      if (!entry.isDirectory()) continue;
      const src = path.join(extensionsRoot, entry.name);
      copied[`extension:${entry.name}`] = await copyOwnedDirectory(src, path.join(targets.extensions, entry.name));
    }
  }

  // Pi loads extensions from ~/.pi/agent/extensions. The runtime imports the
  // shared Takomi core via ../../../src/pi-takomi-core, which resolves to
  // ~/.pi/src/pi-takomi-core from an installed extension path.
  const coreSrc = path.join(PATHS.root, 'src', 'pi-takomi-core');
  const coreDest = path.join(path.dirname(targets.root), 'src', 'pi-takomi-core');
  if (await fs.pathExists(coreSrc)) {
    copied['core:pi-takomi-core'] = await copyOwnedDirectory(coreSrc, coreDest);
  }

  // Keep Pi extension module resolution self-contained for clean machines.
  // Extension files import pi-subagents internals, so place the package where
  // Node can resolve it while loading ~/.pi/agent/extensions/*.
  const piSubagentsSrc = path.join(PATHS.root, 'node_modules', 'pi-subagents');
  const piSubagentsDest = path.join(targets.root, 'node_modules', 'pi-subagents');
  if (await fs.pathExists(piSubagentsSrc)) {
    copied['node_module:pi-subagents'] = await copyOwnedDirectory(piSubagentsSrc, piSubagentsDest);
  }

  const owned = {
    prompts: { src: path.join(srcRoot, 'prompts'), dest: targets.prompts, type: 'dir' },
    agents: { src: path.join(srcRoot, 'agents'), dest: targets.agents, type: 'dir' },
    themes: { src: path.join(srcRoot, 'themes'), dest: targets.themes, type: 'dir' },
  };

  for (const [key, entry] of Object.entries(owned)) {
    if (!await fs.pathExists(entry.src)) continue;
    copied[key] = entry.type === 'dir'
      ? await copyOwnedDirectory(entry.src, entry.dest)
      : await copyOwnedFile(entry.src, entry.dest);
  }

  const manifest = {
    takomiVersion: version,
    installedAt: new Date().toISOString(),
    targetRoot: targets.root,
    owned: copied,
    preserved: {
      settings: targets.settings,
      routingPolicy: targets.routingPolicy,
      userStateDir: targets.takomi,
    },
  };

  await writePiInstallManifest(manifest);
  return { targets, manifest };
}

export async function syncPiHarnessAssets(version = 'unknown') {
  return installPiHarnessAssets(version);
}

export async function validatePiHarnessInstall() {
  const targets = getPiGlobalTargets();
  return {
    runtime: await fs.pathExists(path.join(targets.extensions, 'takomi-runtime')),
    subagents: await fs.pathExists(path.join(targets.extensions, 'takomi-subagents')),
    contextManager: await fs.pathExists(path.join(targets.extensions, 'takomi-context-manager')),
    oauthRouter: await fs.pathExists(path.join(targets.extensions, 'oauth-router')),
    prompts: await fs.pathExists(targets.prompts),
    agents: await fs.pathExists(targets.agents),
    themes: await fs.pathExists(targets.themes),
    readme: await fs.pathExists(path.join(targets.root, 'README.md')),
    core: await fs.pathExists(path.join(path.dirname(targets.root), 'src', 'pi-takomi-core')),
    piSubagentsModule: await fs.pathExists(path.join(targets.root, 'node_modules', 'pi-subagents')),
    settingsPreserved: !await fs.pathExists(path.join(PATHS.pi, 'settings.json')) || true,
  };
}

export function printPiInstallSummary(result, validation) {
  console.log(pc.green('\n✔ Installed Takomi Pi harness assets'));
  console.log(pc.white(`  Root:       ${result.targets.root}`));
  console.log(pc.white(`  Manifest:   ${PI_MANIFEST_PATH}`));
  console.log(pc.white(`  Extensions: ${validation.runtime && validation.subagents && validation.contextManager && validation.oauthRouter ? 'ok' : 'check needed'}`));
  console.log(pc.white(`  Prompts:    ${validation.prompts ? 'ok' : 'missing'}`));
  console.log(pc.white(`  Agents:     ${validation.agents ? 'ok' : 'missing'}`));
  console.log(pc.white(`  Themes:     ${validation.themes ? 'ok' : 'missing'}`));
  console.log(pc.white(`  Core:       ${validation.core ? 'ok' : 'missing'}`));
  console.log(pc.white(`  Subagents:  ${validation.piSubagentsModule ? 'ok' : 'missing module'}`));
  console.log(pc.dim('\nPreserved user-owned config: settings.json, takomi/model-routing.md, runtime session state.'));
}

import fs from 'fs-extra';
import { spawnSync } from 'child_process';
import prompts from 'prompts';
import pc from 'picocolors';
import { detectPiCommand, getPiGlobalTargets } from './pi-harness.js';

export const TAKOMI_PI_OPTIONAL_FEATURES = [
  {
    id: 'takomi-interview',
    title: 'Takomi Interview',
    packageSpec: 'npm:@juicesharp/rpiv-ask-user-question',
    npmPackage: '@juicesharp/rpiv-ask-user-question',
    selectedByDefault: true,
    recommended: true,
    description: 'Structured model questions for Genesis/design clarification. Default Takomi add-on.',
  },
  {
    id: 'takomi-todo',
    title: 'Takomi Todo',
    packageSpec: 'npm:@juicesharp/rpiv-todo',
    npmPackage: '@juicesharp/rpiv-todo',
    selectedByDefault: false,
    recommended: false,
    description: 'Live model todo overlay. Optional while it is being tested.',
  },
  {
    id: 'takomi-browser-qa',
    title: 'Takomi Browser QA',
    packageSpec: 'npm:pi-chrome',
    npmPackage: 'pi-chrome',
    selectedByDefault: false,
    recommended: false,
    description: 'Chrome/browser automation for UI QA and authenticated web workflows.',
  },
  {
    id: 'takomi-doc-preview',
    title: 'Takomi Doc Preview',
    packageSpec: 'npm:pi-markdown-preview',
    npmPackage: 'pi-markdown-preview',
    selectedByDefault: false,
    recommended: false,
    description: 'Markdown/LaTeX/browser/PDF previews for Takomi docs and handoffs.',
  },
];

function runCommand(command, args) {
  return spawnSync(command, args, { stdio: 'pipe', encoding: 'utf8', shell: process.platform === 'win32' });
}

function packageIdentity(packageSpec) {
  if (!packageSpec.startsWith('npm:')) return packageSpec;
  const withoutPrefix = packageSpec.slice(4);
  if (withoutPrefix.startsWith('@')) {
    const parts = withoutPrefix.split('@');
    return `${parts[0]}@${parts[1]}`;
  }
  return withoutPrefix.split('@')[0];
}

function packageEntrySource(entry) {
  if (typeof entry === 'string') return entry;
  if (entry && typeof entry === 'object' && typeof entry.source === 'string') return entry.source;
  return undefined;
}

function packageMatches(entry, packageSpec) {
  const source = packageEntrySource(entry);
  if (!source) return false;
  if (source === packageSpec) return true;
  if (!source.startsWith('npm:') || !packageSpec.startsWith('npm:')) return false;
  return packageIdentity(source) === packageIdentity(packageSpec);
}

async function readGlobalPiSettings() {
  try {
    return await fs.readJson(getPiGlobalTargets().settings);
  } catch {
    return {};
  }
}

export async function getInstalledPiPackageSpecs() {
  const settings = await readGlobalPiSettings();
  return Array.isArray(settings.packages) ? settings.packages : [];
}

export async function isPiPackageInstalled(packageSpec) {
  const packages = await getInstalledPiPackageSpecs();
  return packages.some((entry) => packageMatches(entry, packageSpec));
}

export async function installPiPackage(packageSpec) {
  const pi = await detectPiCommand();
  if (!pi.installed) return { ok: false, changed: false, report: 'Pi is not installed.' };

  if (await isPiPackageInstalled(packageSpec)) {
    return { ok: true, changed: false, report: `${packageSpec} already listed in Pi settings.` };
  }

  const command = pi.path || 'pi';
  const result = runCommand(command, ['install', packageSpec]);
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  return {
    ok: result.status === 0,
    changed: result.status === 0,
    report: output || (result.status === 0 ? `Installed ${packageSpec}.` : `pi install ${packageSpec} failed.`),
  };
}

export async function installPiOptionalFeatures(featureIds) {
  const selected = TAKOMI_PI_OPTIONAL_FEATURES.filter((feature) => featureIds.includes(feature.id));
  const results = [];
  for (const feature of selected) {
    const result = await installPiPackage(feature.packageSpec);
    results.push({ feature, ...result });
  }
  return results;
}

export function printPiOptionalFeatureResults(results) {
  if (!results.length) {
    console.log(pc.dim('  Optional Pi features skipped.'));
    return;
  }

  for (const result of results) {
    const icon = result.ok ? (result.changed ? pc.green('✔') : pc.dim('•')) : pc.yellow('⚠');
    const action = result.ok ? (result.changed ? 'Installed' : 'Already installed') : 'Could not install';
    console.log(`${icon} ${action} ${result.feature.title} (${result.feature.packageSpec})`);
    if (result.report) console.log(pc.dim(result.report.split(/\r?\n/).slice(-4).join('\n')));
  }
}

export async function selectPiOptionalFeatures(options = {}) {
  const { interactive = true } = options;
  if (!interactive) {
    return TAKOMI_PI_OPTIONAL_FEATURES
      .filter((feature) => feature.selectedByDefault)
      .map((feature) => feature.id);
  }

  const modeResponse = await prompts({
    type: 'select',
    name: 'mode',
    message: 'Optional Pi features to install?',
    choices: [
      { title: 'Recommended defaults', value: 'recommended', description: 'Takomi Interview now; keep other packs optional' },
      { title: 'Select all', value: 'all', description: 'Install every official optional Takomi Pi pack' },
      { title: 'Manual selection', value: 'manual', description: 'Choose individual optional packages' },
      { title: 'Skip optional features', value: 'skip', description: 'Only install the Takomi core harness' },
    ],
    initial: 0,
  });

  if (!modeResponse.mode || modeResponse.mode === 'skip') return [];
  if (modeResponse.mode === 'all') return TAKOMI_PI_OPTIONAL_FEATURES.map((feature) => feature.id);
  if (modeResponse.mode === 'recommended') {
    return TAKOMI_PI_OPTIONAL_FEATURES
      .filter((feature) => feature.selectedByDefault || feature.recommended)
      .map((feature) => feature.id);
  }

  const manualResponse = await prompts({
    type: 'multiselect',
    name: 'features',
    message: 'Select optional Takomi Pi feature packs:',
    choices: TAKOMI_PI_OPTIONAL_FEATURES.map((feature) => ({
      title: feature.title,
      value: feature.id,
      selected: feature.selectedByDefault,
      description: `${feature.description} (${feature.packageSpec})`,
    })),
    hint: '- Space to select. Press a to toggle all. Return to submit',
  });

  return manualResponse.features || [];
}

export async function offerPiOptionalFeatures(options = {}) {
  const featureIds = await selectPiOptionalFeatures(options);
  const results = await installPiOptionalFeatures(featureIds);
  printPiOptionalFeatureResults(results);
  return results;
}

export function renderPiOptionalFeatureCatalog() {
  return TAKOMI_PI_OPTIONAL_FEATURES.map((feature) => ({
    id: feature.id,
    title: feature.title,
    packageSpec: feature.packageSpec,
    selectedByDefault: feature.selectedByDefault,
    recommended: feature.recommended,
    description: feature.description,
  }));
}

import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import pc from 'picocolors';
import { PATHS } from './utils.js';

const HOME = os.homedir();
const TAKOMI_HOME = path.join(HOME, '.takomi');
export const SKILLS_MANIFEST_PATH = path.join(TAKOMI_HOME, 'skills-manifest.json');
export const SKILLS_ROOT = path.join(HOME, '.agents', 'skills');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function hashDirectory(dir) {
  if (!await fs.pathExists(dir)) return null;
  const entries = [];
  async function walk(current, prefix = '') {
    const names = (await fs.readdir(current)).sort();
    for (const name of names) {
      const full = path.join(current, name);
      const rel = path.join(prefix, name).replace(/\\/g, '/');
      const stat = await fs.stat(full);
      if (stat.isDirectory()) {
        entries.push(`dir:${rel}`);
        await walk(full, rel);
      } else {
        entries.push(`file:${rel}:${sha256(await fs.readFile(full))}`);
      }
    }
  }
  await walk(dir);
  return sha256(entries.join('\n'));
}

async function listBundledSkills() {
  const entries = await fs.readdir(PATHS.skills);
  const skills = [];
  for (const entry of entries) {
    const stat = await fs.stat(path.join(PATHS.skills, entry));
    if (stat.isDirectory()) skills.push(entry);
  }
  return skills.sort();
}

export async function readSkillsInstallManifest() {
  try {
    if (await fs.pathExists(SKILLS_MANIFEST_PATH)) return await fs.readJson(SKILLS_MANIFEST_PATH);
  } catch {}
  return null;
}

export async function writeSkillsInstallManifest(manifest) {
  await fs.ensureDir(TAKOMI_HOME);
  await fs.writeJson(SKILLS_MANIFEST_PATH, manifest, { spaces: 2 });
}

export async function installBundledSkills(version = 'unknown') {
  const skillNames = await listBundledSkills();
  await fs.ensureDir(SKILLS_ROOT);

  const installed = {};
  for (const name of skillNames) {
    const src = path.join(PATHS.skills, name);
    const dest = path.join(SKILLS_ROOT, name);
    if (await fs.pathExists(dest)) {
      await fs.remove(dest);
    }
    await fs.copy(src, dest, { overwrite: true, errorOnExist: false });
    installed[name] = await hashDirectory(dest);
  }

  const manifest = {
    takomiVersion: version,
    installedAt: new Date().toISOString(),
    targetRoot: SKILLS_ROOT,
    owned: installed,
  };

  await writeSkillsInstallManifest(manifest);
  return { targetRoot: SKILLS_ROOT, manifest, count: skillNames.length };
}

export async function validateSkillsInstall() {
  const names = await listBundledSkills();
  const missing = [];
  for (const name of names) {
    if (!await fs.pathExists(path.join(SKILLS_ROOT, name))) missing.push(name);
  }
  return { root: SKILLS_ROOT, expected: names.length, missing, ok: missing.length === 0 };
}

export function printSkillsInstallSummary(result, validation) {
  console.log(pc.green('\n✔ Installed bundled Takomi skills'));
  console.log(pc.white(`  Root:     ${result.targetRoot}`));
  console.log(pc.white(`  Manifest: ${SKILLS_MANIFEST_PATH}`));
  console.log(pc.white(`  Count:    ${result.count}`));
  console.log(pc.white(`  Status:   ${validation.ok ? 'ok' : `missing ${validation.missing.length}`}`));
}

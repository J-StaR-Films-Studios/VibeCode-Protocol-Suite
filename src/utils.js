import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root of the package (up one level from src/)
const PACKAGE_ROOT = path.resolve(__dirname, '..');

export const PATHS = {
  root: PACKAGE_ROOT,
  agent: path.join(PACKAGE_ROOT, '.agent'),
  workflows: path.join(PACKAGE_ROOT, '.agent', 'workflows'),
  skills: path.join(PACKAGE_ROOT, '.agent', 'skills'),
  agentsYaml: path.join(PACKAGE_ROOT, 'VibeCode-Agents (e.g Kilo-code)'),
  manual: path.join(PACKAGE_ROOT, 'Legacy (Manual Method)'),
};

export async function getWorkflows() {
  try {
    const files = await fs.readdir(PATHS.workflows);
    // filter out directories if any, keep .md files
    return files.filter(f => f.endsWith('.md'));
  } catch (error) {
    return [];
  }
}

export async function getSkills() {
  try {
    const files = await fs.readdir(PATHS.skills);
    // skills are directories
    const skills = [];
    for (const file of files) {
      const stats = await fs.stat(path.join(PATHS.skills, file));
      if (stats.isDirectory()) {
        skills.push(file);
      }
    }
    return skills;
  } catch (error) {
    return [];
  }
}

export async function copyToDestination(source, dest) {
  try {
    await fs.copy(source, dest, { overwrite: true });
    return true;
  } catch (error) {
    console.error(`Error copying ${source} to ${dest}:`, error);
    return false;
  }
}

export async function copySpecificWorkflows(selectedWorkflows, destFolder) {
  // Ensure dest folder exists
  await fs.ensureDir(destFolder);
  
  for (const workflow of selectedWorkflows) {
    const src = path.join(PATHS.workflows, workflow);
    const dest = path.join(destFolder, workflow);
    await fs.copy(src, dest, { overwrite: true });
  }
}

export async function copySpecificSkills(selectedSkills, destFolder) {
  // Ensure dest folder exists
  await fs.ensureDir(destFolder);

  for (const skill of selectedSkills) {
    const src = path.join(PATHS.skills, skill);
    const dest = path.join(destFolder, skill);
    await fs.copy(src, dest, { overwrite: true });
  }
}

#!/usr/bin/env node
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import assert from 'node:assert/strict';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-skills-test-'));
process.env.TAKOMI_HOME_DIR = path.join(tempRoot, '.takomi');
process.env.TAKOMI_SKILLS_ROOT = path.join(tempRoot, '.agents', 'skills');

const catalog = await import('../src/skills-catalog.js');
const installer = await import('../src/skills-installer.js');

const core = await catalog.getValidCoreSkills();
assert.deepEqual(core, [
  'takomi',
  'sync-docs',
  'code-review',
  'security-audit',
  'optimize-agent-context',
  'agent-recovery',
  'avoid-feature-creep',
  'ai-sdk',
  'git-commit-generation',
]);
assert.equal(core.includes('context7'), false, 'context7 must not be core');
assert.equal(core.includes('spawn-task'), false, 'spawn-task must not be core');

const allSkills = await catalog.listBundledSkillNames();
let result = await installer.installBundledSkills('test', { mode: 'all', selectedSkills: allSkills });
assert.equal(result.selectedCount, allSkills.length, 'all mode should select every bundled skill');
assert.equal(await fs.pathExists(path.join(process.env.TAKOMI_SKILLS_ROOT, 'ai-avatar-video')), true);

await fs.ensureDir(path.join(process.env.TAKOMI_SKILLS_ROOT, 'my-manual-skill'));
await fs.writeFile(path.join(process.env.TAKOMI_SKILLS_ROOT, 'my-manual-skill', 'SKILL.md'), 'manual skill');

result = await installer.installBundledSkills('test', { mode: 'core', selectedSkills: core });
assert.equal(result.selectedCount, core.length, 'core mode selected count mismatch');
assert.equal(await fs.pathExists(path.join(process.env.TAKOMI_SKILLS_ROOT, 'ai-avatar-video')), false, 'deselected Takomi-owned optional skill should be pruned');
assert.equal(await fs.pathExists(path.join(process.env.TAKOMI_SKILLS_ROOT, 'my-manual-skill')), true, 'manual skill must be preserved');
assert.equal(await fs.pathExists(path.join(process.env.TAKOMI_SKILLS_ROOT, 'ai-sdk')), true, 'ai-sdk should remain core');
assert.equal(await fs.pathExists(path.join(process.env.TAKOMI_SKILLS_ROOT, 'git-commit-generation')), true, 'git-commit-generation should remain core');

const manifest = await installer.readSkillsInstallManifest();
assert.equal(manifest.mode, 'core');
assert.equal(manifest.selectedSkills.includes('context7'), false);
assert.equal(manifest.selectedSkills.includes('spawn-task'), false);
assert.equal(manifest.selectedSkills.includes('ai-sdk'), true);
assert.equal(manifest.selectedSkills.includes('git-commit-generation'), true);

await fs.remove(tempRoot);
console.log('✓ skill selection installer tests passed');

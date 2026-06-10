#!/usr/bin/env node
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import assert from 'node:assert/strict';

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-skills-test-'));
process.env.TAKOMI_HOME_DIR = path.join(tempRoot, '.takomi');
process.env.TAKOMI_STORE_PATH = path.join(tempRoot, '.takomi');
process.env.TAKOMI_SKILLS_ROOT = path.join(tempRoot, '.agents', 'skills');

const catalog = await import('../src/skills-catalog.js');
const installer = await import('../src/skills-installer.js');
const store = await import('../src/store.js');
const harness = await import('../src/harness.js');

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

await store.initGlobalStore();
await store.populateSkills('all');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'ai-avatar-video')), true, 'all store populate should copy optional skills');
await fs.ensureDir(path.join(store.STORE_PATH, 'skills', 'manual-store-skill'));
await fs.writeFile(path.join(store.STORE_PATH, 'skills', 'manual-store-skill', 'SKILL.md'), 'manual store skill');
await store.populateSkills('core');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'ai-avatar-video')), false, 'store should prune deselected Takomi-owned optional skills');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'manual-store-skill')), true, 'store should preserve manual skills');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'skills', 'ai-sdk')), true, 'store core should include ai-sdk');

await store.populateWorkflows('all');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'agent_reset.md')), true, 'all workflow populate should copy optional workflows');
await fs.writeFile(path.join(store.STORE_PATH, 'workflows', 'manual-workflow.md'), 'manual workflow');
await store.populateWorkflows('core');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'agent_reset.md')), false, 'store should prune deselected Takomi-owned workflows');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'manual-workflow.md')), true, 'store should preserve manual workflows');
assert.equal(await fs.pathExists(path.join(store.STORE_PATH, 'workflows', 'vibe-build.md')), true, 'store core should include vibe-build workflow');

const harnessTarget = path.join(tempRoot, 'harness-skills');
let syncResult = await harness.syncDirectory(path.join(store.STORE_PATH, 'skills'), harnessTarget, '', {
  useOwnership: true,
  preserveManual: true,
  prune: true,
  returnDetails: true,
});
assert.equal(await fs.pathExists(path.join(harnessTarget, 'ai-sdk')), true, 'harness sync should copy selected store skills');
await fs.ensureDir(path.join(harnessTarget, 'manual-harness-skill'));
await fs.writeFile(path.join(harnessTarget, 'manual-harness-skill', 'SKILL.md'), 'manual harness skill');
await store.populateSkills(['takomi']);
syncResult = await harness.syncDirectory(path.join(store.STORE_PATH, 'skills'), harnessTarget, '', {
  owned: syncResult.owned,
  preserveManual: true,
  prune: true,
  returnDetails: true,
});
assert.equal(await fs.pathExists(path.join(harnessTarget, 'ai-sdk')), false, 'harness sync should prune deselected Takomi-owned skills');
assert.equal(await fs.pathExists(path.join(harnessTarget, 'manual-harness-skill')), true, 'harness sync should preserve manual skills');
assert.equal(await fs.pathExists(path.join(harnessTarget, 'takomi')), true, 'harness sync should keep selected skills');

await fs.remove(tempRoot);
console.log('✓ skill selection installer tests passed');

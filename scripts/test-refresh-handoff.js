#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runUpdatedTakomi } from '../src/update-check.js';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'takomi-refresh-handoff-'));
const globalRoot = path.join(dir, 'global-modules');
const packageRoot = path.join(globalRoot, 'takomi');
const record = path.join(dir, 'handoff.json');
const previousRecord = process.env.TAKOMI_TEST_REFRESH_RECORD;

try {
  await fs.ensureDir(path.join(packageRoot, 'bin'));
  await fs.ensureDir(path.join(packageRoot, 'assets', '.agent', 'skills', 'new-skill'));
  await fs.writeFile(path.join(packageRoot, 'bin', 'takomi.js'), `
const fs = require('node:fs');
const path = require('node:path');
fs.writeFileSync(process.env.TAKOMI_TEST_REFRESH_RECORD, JSON.stringify({
  args: process.argv.slice(2),
  skills: fs.readdirSync(path.join(__dirname, '..', 'assets', '.agent', 'skills')),
  cwd: process.cwd(),
}));
`);

  process.env.TAKOMI_TEST_REFRESH_RECORD = record;
  assert.equal(runUpdatedTakomi('skills', globalRoot), 0);
  assert.deepEqual(await fs.readJson(record), {
    args: ['__refresh-installed', 'skills'],
    skills: ['new-skill'],
    cwd: process.cwd(),
  }, 'refresh continuation must run against the updated package and preserve the project cwd');

  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const continuation = spawnSync(process.execPath, [path.join(repoRoot, 'bin', 'takomi.js'), '__refresh-installed', 'skills'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      TAKOMI_HOME_DIR: path.join(dir, 'home'),
      TAKOMI_STORE_PATH: path.join(dir, 'home'),
      TAKOMI_SKILLS_ROOT: path.join(dir, 'skills'),
      TAKOMI_SKILLS_MODE: 'core',
    },
  });
  assert.equal(continuation.status, 0, continuation.stderr);
  assert.match(continuation.stdout, /Takomi Skills Install/);
  assert.doesNotMatch(continuation.stdout, /Updating Takomi from npm/);
  assert.equal(await fs.pathExists(path.join(dir, 'skills', 'babysit-pr', 'SKILL.md')), true);

  await fs.remove(path.join(packageRoot, 'bin', 'takomi.js'));
  const originalError = console.error;
  const errors = [];
  try {
    console.error = (message) => errors.push(message);
    assert.equal(runUpdatedTakomi('skills', globalRoot), 1, 'missing new CLI must not install old bundled skills');
  } finally {
    console.error = originalError;
  }
  assert.match(errors[0], /Stopping before installing stale skills/);
} finally {
  if (previousRecord === undefined) delete process.env.TAKOMI_TEST_REFRESH_RECORD;
  else process.env.TAKOMI_TEST_REFRESH_RECORD = previousRecord;
  await fs.remove(dir);
}

console.log('✓ refresh handoff uses the newly installed package');

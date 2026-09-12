import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

console.log('🧪 Running stats cache parity tests...');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedPath = path.join(repoRoot, 'src', 'takomi-cache.js');
const runtimePath = path.join(
  repoRoot,
  '.pi',
  'extensions',
  'takomi-runtime',
  'takomi-stats.js',
);

// The runtime extension intentionally mirrors src/takomi-cache.js because global
// Pi installs do not sync src/ (see scripts/sync-pi-global.ps1). This test fails
// when the two copies drift so the divergence is caught, not silent.
function extractFunction(source, name) {
  // Strip line comments first: whitespace is collapsed later, which would
  // extend a // comment to end of string and eat real code.
  const noComments = source.replace(/\/\/[^\n]*/g, '');
  const match = noComments.match(new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`));
  assert.ok(match, `function ${name} must exist`);
  let depth = 0;
  let started = false;
  for (let i = match.index; i < noComments.length; i += 1) {
    const ch = noComments[i];
    if (ch === '{') {
      depth += 1;
      started = true;
    } else if (ch === '}') {
      depth -= 1;
      if (started && depth === 0) {
        return noComments.slice(match.index, i + 1).replace(/\s+/g, '');
      }
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const shared = fs.readFileSync(sharedPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');

const sharedVersion = shared.match(/const CACHE_VERSION\s*=\s*(\d+)/)?.[1];
const runtimeVersion = runtime.match(/const CACHE_VERSION\s*=\s*(\d+)/)?.[1];
assert.ok(sharedVersion, 'shared copy must declare CACHE_VERSION');
assert.strictEqual(runtimeVersion, sharedVersion, 'CACHE_VERSION must match across copies');

for (const name of [
  'getStatsCachePath',
  'serializeRow',
  'deserializeRow',
  'loadStatsCache',
  'saveStatsCache',
]) {
  const normalize = (src) => extractFunction(src, name).replace(/^export/, '');
  const a = normalize(shared);
  const b = normalize(runtime);
  assert.strictEqual(b, a, `${name} must stay identical across copies`);
}

console.log('✓ stats cache parity passed');

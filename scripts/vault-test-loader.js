import { registerHooks } from "node:module";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const extension = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../.pi/extensions/takomi-vault",
);
const allowed = new Set([
  "adapters.ts",
  "audit.ts",
  "commands.ts",
  "config.ts",
  "crypto-store.ts",
  "grant-store.ts",
  "input-guard.ts",
  "index.ts",
  "key-provider.ts",
  "secret-input.ts",
  "tools.ts",
  "transfer.ts",
  "types.ts",
  "vault-store.ts",
]);

// Installed before dynamic imports, including in subprocesses. No OS key-provider code runs.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.startsWith("file:")) return nextLoad(url, context);
    const file = fileURLToPath(url);
    if (dirname(file) !== extension) return nextLoad(url, context);
    const home = resolve(homedir());
    if (
      dirname(home) !== resolve(tmpdir()) ||
      !/^takomi-(vault-test|vault-input|transfer|import|rpc-import)-/.test(basename(home))
    ) {
      throw new Error("Vault tests require an owned temporary home before loading source.");
    }
    const name = basename(file);
    if (!allowed.has(name)) throw new Error("Unexpected Vault module in strict test graph.");
    if (name !== "key-provider.ts") return nextLoad(url, context);
    return {
      format: "module",
      shortCircuit: true,
      source: `
      import { existsSync } from 'node:fs';
      import { randomBytes } from 'node:crypto';
      import { KEY_PATH, VAULT_PATH, readJsonFile, writeJsonFile } from './config.ts';
      export function hasStoredOsKey() { return false; }
      export function resolveDataKey() {
        if (existsSync(KEY_PATH)) {
          const stored = readJsonFile(KEY_PATH, undefined);
          if (stored?.version !== 1 || stored.backend !== 'file-permissions' || typeof stored.key !== 'string') {
            throw new Error('Invalid synthetic test key');
          }
          return {key: Buffer.from(stored.key, 'base64'), backend: 'file-permissions'};
        }
        if (existsSync(VAULT_PATH)) throw new Error('Vault key is missing while synthetic vault data exists.');
        const key = randomBytes(32);
        writeJsonFile(KEY_PATH, {version:1, backend:'file-permissions', key:key.toString('base64')});
        return {key, backend:'file-permissions'};
      }
    `,
    };
  },
});

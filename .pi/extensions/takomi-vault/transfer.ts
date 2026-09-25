import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { GRANTS_PATH, KEY_PATH, VAULT_PATH, withJsonFileLock } from "./config.ts";
import { clearKeyCache, decryptField, encryptField, getBackend } from "./crypto-store.ts";
import { listCredentials } from "./vault-store.ts";
import { hasStoredOsKey } from "./key-provider.ts";
import type { CredentialType, FieldVisibility, StoredCredential } from "./types.ts";

const MAX_ARCHIVE = 12 * 1024 * 1024;
const MAX_PLAIN = 8 * 1024 * 1024;
const FAILURE = "Vault transfer failed. Check the file, transfer key, and empty destination vault.";

type PlainCredential = Omit<StoredCredential, "fields" | "createdBy"> & {
  fields: Array<{ name: string; visibility: FieldVisibility; value: string }>;
};

function decode(value: unknown, bytes: number): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error(FAILURE);
  const buffer = Buffer.from(value, "base64");
  if (buffer.length !== bytes || buffer.toString("base64") !== value) throw new Error(FAILURE);
  return buffer;
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\x00-\x1f\x7f]/.test(value);
}

function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function parseCredentials(value: unknown): PlainCredential[] {
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1 || !("credentials" in value) || !Array.isArray(value.credentials) || value.credentials.length > 10000) throw new Error(FAILURE);
  const ids = new Set<string>();
  return value.credentials.map((raw: unknown) => {
    if (typeof raw !== "object" || raw === null) throw new Error(FAILURE);
    const entry = raw as Record<string, unknown>;
    if (typeof entry.id !== "string" || !/^cred_[A-F0-9]{32}$/.test(entry.id) || ids.has(entry.id)
      || !text(entry.label) || !text(entry.service) || !text(entry.host)
      || (entry.type !== "login" && entry.type !== "token")
      || !timestamp(entry.createdAt) || !timestamp(entry.updatedAt)
      || (entry.lastUsedAt !== undefined && !timestamp(entry.lastUsedAt))
      || !Array.isArray(entry.fields) || entry.fields.length < 1 || entry.fields.length > 64) throw new Error(FAILURE);
    ids.add(entry.id);
    const names = new Set<string>();
    const fields: PlainCredential["fields"] = entry.fields.map((rawField: unknown) => {
      if (typeof rawField !== "object" || rawField === null) throw new Error(FAILURE);
      const field = rawField as Record<string, unknown>;
      const visibility = field.visibility;
      if (!text(field.name) || names.has(field.name) || (visibility !== "inject-only" && visibility !== "agent-readable") || typeof field.value !== "string" || Buffer.byteLength(field.value) > MAX_PLAIN) throw new Error(FAILURE);
      names.add(field.name);
      return { name: field.name, visibility, value: field.value };
    });
    return { id: entry.id, label: entry.label, service: entry.service, host: entry.host,
      type: entry.type as CredentialType, createdAt: entry.createdAt, updatedAt: entry.updatedAt,
      ...(entry.lastUsedAt === undefined ? {} : { lastUsedAt: entry.lastUsedAt as number }), fields };
  });
}

function occupied(path: string): boolean {
  try { lstatSync(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function readBounded(path: string): Buffer {
  if (!lstatSync(path).isFile()) throw new Error(FAILURE);
  const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_ARCHIVE) throw new Error(FAILURE);
    const buffer = Buffer.alloc(MAX_ARCHIVE + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(fd, buffer, offset, buffer.length - offset, null);
      if (!count) break;
      offset += count;
    }
    if (offset > MAX_ARCHIVE) throw new Error(FAILURE);
    return buffer.subarray(0, offset);
  } finally {
    closeSync(fd);
  }
}

/** The returned key must only be shown through human UI, never tool or command results. */
export function exportVault(path: string, expectedParent: string): string {
  const credentials = listCredentials().map((entry) => ({
    id: entry.id, label: entry.label, service: entry.service, host: entry.host, type: entry.type,
    createdAt: entry.createdAt, updatedAt: entry.updatedAt, lastUsedAt: entry.lastUsedAt,
    fields: entry.fields.map((field) => ({ name: field.name, visibility: field.visibility, value: decryptField(field.valueEnc) })),
  }));
  const plain = Buffer.from(JSON.stringify({ version: 1, credentials }), "utf8");
  if (plain.length > MAX_PLAIN) throw new Error(FAILURE);
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  const archive = JSON.stringify({ version: 1, algorithm: "aes-256-gcm", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
  if (Buffer.byteLength(archive) > MAX_ARCHIVE) throw new Error(FAILURE);
  if (realpathSync(dirname(path)) !== expectedParent) throw new Error(FAILURE);
  writeFileSync(path, archive, { encoding: "utf8", mode: 0o600, flag: "wx" });
  return key.toString("hex");
}

export function importVault(path: string, transferKey: string): number {
  try {
    // Validate and authenticate the entire archive before creating a destination key or vault.
    const archive: unknown = JSON.parse(readBounded(path).toString("utf8"));
    if (typeof archive !== "object" || archive === null) throw new Error(FAILURE);
    const record = archive as Record<string, unknown>;
    if (record.version !== 1 || record.algorithm !== "aes-256-gcm" || !/^[a-fA-F0-9]{64}$/.test(transferKey)) throw new Error(FAILURE);
    const key = Buffer.from(transferKey, "hex");
    const decipher = createDecipheriv("aes-256-gcm", key, decode(record.iv, 12));
    decipher.setAuthTag(decode(record.tag, 16));
    if (typeof record.data !== "string" || record.data.length > MAX_ARCHIVE) throw new Error(FAILURE);
    const payload = Buffer.from(record.data, "base64");
    if (payload.toString("base64") !== record.data || payload.length > MAX_PLAIN) throw new Error(FAILURE);
    const plain = Buffer.concat([decipher.update(payload), decipher.final()]);
    if (plain.length > MAX_PLAIN) throw new Error(FAILURE);
    const credentials = parseCredentials(JSON.parse(plain.toString("utf8")));
    return withJsonFileLock(VAULT_PATH, () => {
      // A pre-existing empty vault file also counts as existing state. Never replace it.
      if (occupied(VAULT_PATH) || occupied(KEY_PATH) || occupied(GRANTS_PATH)) throw new Error(FAILURE);
      const stored = withJsonFileLock(KEY_PATH, (): StoredCredential[] => {
        if (occupied(KEY_PATH) || occupied(VAULT_PATH) || occupied(GRANTS_PATH) || hasStoredOsKey()) throw new Error(FAILURE);
        clearKeyCache();
        getBackend();
        return credentials.map((entry) => ({
          id: entry.id, label: entry.label, service: entry.service, host: entry.host, type: entry.type,
          createdBy: "human", createdAt: entry.createdAt, updatedAt: entry.updatedAt,
          ...(entry.lastUsedAt === undefined ? {} : { lastUsedAt: entry.lastUsedAt }),
          fields: entry.fields.map((field) => ({ name: field.name, visibility: field.visibility, valueEnc: encryptField(field.value) })),
        }));
      });
      // Exclusive creation prevents a concurrent writer from replacing a vault file.
      writeFileSync(VAULT_PATH, JSON.stringify({ version: 1, credentials: stored }), { encoding: "utf8", mode: 0o600, flag: "wx" });
      return stored.length;
    });
  } catch {
    // Filesystem and crypto errors may contain paths or attacker-controlled input.
    throw new Error(FAILURE);
  }
}

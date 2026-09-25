import { randomUUID } from "node:crypto";
import { VAULT_PATH, readJsonFile, writeJsonFile } from "./config.ts";
import { decryptField, encryptField } from "./crypto-store.ts";
import type { CredentialSummary, CredentialType, FieldVisibility, StoredCredential } from "./types.ts";

const EMPTY = { version: 1 as const, credentials: [] as StoredCredential[] };

function load(): StoredCredential[] {
  const file = readJsonFile<unknown>(VAULT_PATH, EMPTY);
  if (typeof file !== "object" || file === null || !("version" in file) || file.version !== 1
    || !("credentials" in file) || !Array.isArray(file.credentials) || !file.credentials.every(isCredential)) {
    throw new Error("Vault file has invalid structure; refusing to use it.");
  }
  return file.credentials;
}

function isCredential(value: unknown): value is StoredCredential {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.id === "string" && typeof entry.label === "string"
    && typeof entry.service === "string" && typeof entry.host === "string"
    && (entry.type === "login" || entry.type === "token")
    && typeof entry.createdBy === "string"
    && typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
    && typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
    && (entry.lastUsedAt === undefined || (typeof entry.lastUsedAt === "number" && Number.isFinite(entry.lastUsedAt)))
    && Array.isArray(entry.fields) && entry.fields.every((item: unknown) => {
      if (typeof item !== "object" || item === null) return false;
      const field = item as Record<string, unknown>;
      if (typeof field.valueEnc !== "object" || field.valueEnc === null) return false;
      const enc = field.valueEnc as Record<string, unknown>;
      return typeof field.name === "string" && (field.visibility === "inject-only" || field.visibility === "agent-readable")
        && typeof enc.iv === "string" && typeof enc.tag === "string" && typeof enc.data === "string";
    });
}

function save(credentials: StoredCredential[]) {
  writeJsonFile(VAULT_PATH, { version: 1, credentials });
}

export function summarize(credential: StoredCredential): CredentialSummary {
  return {
    id: credential.id,
    label: credential.label,
    service: credential.service,
    host: credential.host,
    type: credential.type,
    fieldNames: credential.fields.map((field) => field.name),
    createdAt: credential.createdAt,
    lastUsedAt: credential.lastUsedAt,
  };
}

export function listCredentials(): StoredCredential[] {
  return [...load()].sort((a, b) => a.createdAt - b.createdAt);
}

export function getCredential(id: string): StoredCredential | undefined {
  return load().find((entry) => entry.id === id);
}

export function findByService(service: string, host?: string): StoredCredential[] {
  const needle = service.trim().toLowerCase();
  return load().filter((entry) => {
    const serviceMatch = entry.service.toLowerCase() === needle;
    if (!host) return serviceMatch;
    return serviceMatch && entry.host.toLowerCase() === host.trim().toLowerCase();
  });
}

export function createCredential(input: {
  label: string;
  service: string;
  host: string;
  type: CredentialType;
  fields: Array<{ name: string; value: string; visibility?: FieldVisibility }>;
  createdBy?: string;
}): StoredCredential {
  const label = input.label.trim();
  if (!label) throw new Error("Credential label cannot be empty");
  const credentials = load();
  const credential: StoredCredential = {
    id: `cred_${randomUUID().replace(/-/g, "").toUpperCase()}`,
    label,
    service: input.service.trim().toLowerCase(),
    host: input.host.trim().toLowerCase(),
    type: input.type,
    createdBy: input.createdBy ?? "human",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fields: input.fields.map((field) => ({
      name: field.name,
      visibility: field.visibility ?? "inject-only",
      valueEnc: encryptField(field.value),
    })),
  };
  credentials.push(credential);
  save(credentials);
  return credential;
}

export function renameCredential(id: string, label: string): StoredCredential {
  const next = label.trim();
  if (!next) throw new Error("Credential label cannot be empty");
  const credentials = load();
  const entry = credentials.find((item) => item.id === id);
  if (!entry) throw new Error(`Unknown credential: ${id}`);
  entry.label = next;
  entry.updatedAt = Date.now();
  save(credentials);
  return entry;
}

export function deleteCredential(id: string) {
  save(load().filter((entry) => entry.id !== id));
}

export function getFieldValue(credential: StoredCredential, name: string): string {
  const field = credential.fields.find((entry) => entry.name === name);
  if (!field) {
    const available = credential.fields.map((entry) => entry.name).join(", ") || "none";
    throw new Error(`Unknown field ${name} on ${credential.id} (available: ${available})`);
  }
  return decryptField(field.valueEnc);
}

export function isEphemeral(credential: StoredCredential): boolean {
  return credential.createdBy === "agent-once";
}

export function deleteIfEphemeral(id: string): boolean {
  const entry = getCredential(id);
  if (!entry || !isEphemeral(entry)) return false;
  deleteCredential(id);
  return true;
}

export function touchUsed(id: string) {
  const credentials = load();
  const entry = credentials.find((item) => item.id === id);
  if (!entry) return;
  entry.lastUsedAt = Date.now();
  entry.updatedAt = Date.now();
  save(credentials);
}

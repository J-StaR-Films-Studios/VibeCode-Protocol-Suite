import { randomUUID } from "node:crypto";
import { VAULT_PATH, readJsonFile, writeJsonFile } from "./config.ts";
import { decryptField, encryptField } from "./crypto-store.ts";
import type { CredentialSummary, CredentialType, FieldVisibility, StoredCredential } from "./types.ts";

const EMPTY = { version: 1 as const, credentials: [] as StoredCredential[] };

function load(): StoredCredential[] {
  const file = readJsonFile(VAULT_PATH, EMPTY);
  return Array.isArray(file.credentials) ? file.credentials : [];
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

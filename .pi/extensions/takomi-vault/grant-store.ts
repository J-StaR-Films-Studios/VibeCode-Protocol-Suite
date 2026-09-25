import { randomUUID } from "node:crypto";
import { GRANTS_PATH, readJsonFile, withJsonFileLock, writeJsonFile } from "./config.ts";
import { logAudit } from "./audit.ts";
import type { CredentialGrant, GrantScope } from "./types.ts";

const VALID_SCOPES: GrantScope[] = ["once", "turn", "session", "target"];

function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").toUpperCase()}`;
}

const EMPTY = { version: 1 as const, grants: [] as CredentialGrant[] };

const SCOPE_TTL_MS: Record<GrantScope, number> = {
  once: 5 * 60 * 1000,
  turn: 15 * 60 * 1000,
  session: 12 * 60 * 60 * 1000,
  target: 30 * 24 * 60 * 60 * 1000,
};

function load(): CredentialGrant[] {
  const file = readJsonFile<unknown>(GRANTS_PATH, EMPTY);
  if (typeof file !== "object" || file === null || !("version" in file) || file.version !== 1
    || !("grants" in file) || !Array.isArray(file.grants) || !file.grants.every(isGrant)) {
    throw new Error("Grant file has invalid structure; refusing to use it.");
  }
  return file.grants;
}

function isGrant(value: unknown): value is CredentialGrant {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return typeof g.grantId === "string" && typeof g.credentialId === "string"
    && typeof g.agent === "string" && typeof g.tool === "string"
    && typeof g.target === "string" && typeof g.operation === "string"
    && (g.scope === "once" || g.scope === "turn" || g.scope === "session" || g.scope === "target")
    && typeof g.expiresAt === "number" && Number.isFinite(g.expiresAt)
    && typeof g.createdAt === "number" && Number.isFinite(g.createdAt)
    && typeof g.revoked === "boolean" && typeof g.useCount === "number" && Number.isSafeInteger(g.useCount) && g.useCount >= 0
    && (g.fields === undefined || (Array.isArray(g.fields) && g.fields.every((field: unknown) => typeof field === "string")));
}

function save(grants: CredentialGrant[]) {
  writeJsonFile(GRANTS_PATH, { version: 1, grants });
}

export function issueGrant(input: {
  credentialId: string;
  agent?: string;
  tool?: string;
  target: string;
  operation?: string;
  scope: GrantScope;
  fields?: string[];
}): CredentialGrant {
  const target = input.target.trim().toLowerCase();
  if (!target) throw new Error("Grant target cannot be empty");
  if (!VALID_SCOPES.includes(input.scope)) throw new Error(`Unknown grant scope: ${input.scope}`);
  if (input.fields && (!input.fields.length || input.fields.some((field) => !field.trim()))) throw new Error("Grant fields cannot be empty");
  return withJsonFileLock(GRANTS_PATH, () => {
    const grants = load();
    const grant: CredentialGrant = {
      grantId: newId("grant"),
      credentialId: input.credentialId,
      agent: input.agent ?? "pi",
      tool: input.tool ?? "terminal",
      target,
      operation: input.operation ?? "use",
      fields: input.fields,
      scope: input.scope,
      expiresAt: Date.now() + SCOPE_TTL_MS[input.scope],
      revoked: false,
      createdAt: Date.now(),
      useCount: 0,
    };
    grants.push(grant);
    save(grants);
    return grant;
  });
}

function checkGrant(grants: CredentialGrant[], grantId: string, target: string, tool: string, operation: string, agent: string, fields: string[]): CredentialGrant {
  const grant = grants.find((entry) => entry.grantId === grantId);
  if (!grant) throw new Error(`Unknown grant: ${grantId}`);
  if (grant.revoked) throw new Error(`Grant ${grantId} was revoked`);
  if (grant.expiresAt <= Date.now()) throw new Error(`Grant ${grantId} expired`);
  if (grant.target !== target.trim().toLowerCase()) {
    throw new Error(`Grant ${grantId} is bound to ${grant.target}, denied for ${target}`);
  }
  if (grant.tool !== tool && grant.tool !== "any") {
    throw new Error(`Grant ${grantId} is bound to tool ${grant.tool}, denied for ${tool}`);
  }
  if (grant.agent !== agent) throw new Error(`Grant ${grantId} is bound to agent ${grant.agent}`);
  if (grant.operation !== operation) throw new Error(`Grant ${grantId} is bound to operation ${grant.operation}`);
  if (grant.fields && fields.some((field) => !grant.fields?.includes(field))) throw new Error(`Grant ${grantId} does not allow requested fields`);
  if (grant.scope === "once" && grant.useCount >= 1) throw new Error(`Grant ${grantId} was single use and is spent`);
  return grant;
}

/** Validate and spend under the same cross-process file lock. */
export function spendGrant(input: { grantId: string; credentialId: string; target: string; tool: string; operation: string; agent: string; fields: string[]; persistent?: boolean }): CredentialGrant {
  return withJsonFileLock(GRANTS_PATH, () => {
    const grants = load();
    const grant = checkGrant(grants, input.grantId, input.target, input.tool, input.operation, input.agent, input.fields);
    if (grant.credentialId !== input.credentialId) throw new Error("Grant does not belong to this credential");
    if (input.persistent && grant.scope !== "target" && grant.scope !== "session") throw new Error("Permanent file writes need a session or target grant.");
    grant.useCount += 1;
    save(grants);
    return grant;
  });
}

export function revokeGrants(filter: { grantId?: string; credentialId?: string; scope?: GrantScope; all?: boolean }): CredentialGrant[] {
  return withJsonFileLock(GRANTS_PATH, () => {
    const grants = load();
    const revoked: CredentialGrant[] = [];
    for (const grant of grants) {
      if (filter.all
        || (filter.grantId && grant.grantId === filter.grantId)
        || (filter.credentialId && grant.credentialId === filter.credentialId)
        || (filter.scope && grant.scope === filter.scope)) {
        if (!grant.revoked) {
          grant.revoked = true;
          revoked.push(grant);
        }
      }
    }
    save(grants);
    return revoked;
  });
}

export function listGrants(credentialId?: string): CredentialGrant[] {
  const grants = load().filter((grant) => !credentialId || grant.credentialId === credentialId);
  return [...grants].sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeExpiredSessionGrants() {
  withJsonFileLock(GRANTS_PATH, () => {
    const grants = load();
    let changed = false;
    for (const grant of grants) {
      if (!grant.revoked && grant.expiresAt <= Date.now()) {
        grant.revoked = true;
        changed = true;
        logAudit({ at: Date.now(), credentialId: grant.credentialId, agent: grant.agent, event: "expired", target: grant.target, result: `grant ${grant.grantId} scope=${grant.scope}` });
      }
    }
    if (changed) save(grants);
  });
}

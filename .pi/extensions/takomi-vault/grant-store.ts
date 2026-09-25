import { randomUUID } from "node:crypto";
import { GRANTS_PATH, readJsonFile, writeJsonFile } from "./config.ts";
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
  const file = readJsonFile(GRANTS_PATH, EMPTY);
  return Array.isArray(file.grants) ? file.grants : [];
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
}): CredentialGrant {
  const target = input.target.trim().toLowerCase();
  if (!target) throw new Error("Grant target cannot be empty");
  if (!VALID_SCOPES.includes(input.scope)) throw new Error(`Unknown grant scope: ${input.scope}`);
  const grants = load();
  const grant: CredentialGrant = {
    grantId: newId("grant"),
    credentialId: input.credentialId,
    agent: input.agent ?? "pi",
    tool: input.tool ?? "terminal",
    target,
    operation: input.operation ?? "use",
    scope: input.scope,
    expiresAt: Date.now() + SCOPE_TTL_MS[input.scope],
    revoked: false,
    createdAt: Date.now(),
    useCount: 0,
  };
  grants.push(grant);
  save(grants);
  return grant;
}

export function validateGrant(grantId: string, target: string, tool?: string): CredentialGrant {
  const grants = load();
  const grant = grants.find((entry) => entry.grantId === grantId);
  if (!grant) throw new Error(`Unknown grant: ${grantId}`);
  if (grant.revoked) throw new Error(`Grant ${grantId} was revoked`);
  if (grant.expiresAt <= Date.now()) throw new Error(`Grant ${grantId} expired`);
  if (grant.target !== target.trim().toLowerCase()) {
    throw new Error(`Grant ${grantId} is bound to ${grant.target}, denied for ${target}`);
  }
  if (tool && grant.tool !== tool && grant.tool !== "any") {
    throw new Error(`Grant ${grantId} is bound to tool ${grant.tool}, denied for ${tool}`);
  }
  if (grant.scope === "once" && grant.useCount >= 1) throw new Error(`Grant ${grantId} was single use and is spent`);
  return grant;
}

export function recordUse(grantId: string) {
  const grants = load();
  const grant = grants.find((entry) => entry.grantId === grantId);
  if (!grant) return;
  grant.useCount += 1;
  save(grants);
}

export function revokeGrants(filter: { grantId?: string; credentialId?: string; scope?: GrantScope; all?: boolean }): CredentialGrant[] {
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
}

export function listGrants(credentialId?: string): CredentialGrant[] {
  const grants = load().filter((grant) => !credentialId || grant.credentialId === credentialId);
  return [...grants].sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeExpiredSessionGrants() {
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
}

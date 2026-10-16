import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DATA_ROOT, writeJsonFile } from "./config.ts";
import { deleteIfEphemeral, getCredential, getFieldValue, touchUsed } from "./vault-store.ts";
import { spendGrant } from "./grant-store.ts";
import { logAudit } from "./audit.ts";
import { VaultOperationError } from "./types.ts";

const TEMP_TRACK_PATH = join(DATA_ROOT, "tempfiles.json");

function trackTempFile(path: string) {
  let tracked: string[] = [];
  try {
    if (existsSync(TEMP_TRACK_PATH)) tracked = JSON.parse(readFileSync(TEMP_TRACK_PATH, "utf8")) as string[];
  } catch {
    tracked = [];
  }
  if (!tracked.includes(path)) {
    tracked.push(path);
    writeJsonFile(TEMP_TRACK_PATH, tracked);
  }
}

export function cleanupTempFiles(): string[] {
  let tracked: string[] = [];
  try {
    if (existsSync(TEMP_TRACK_PATH)) tracked = JSON.parse(readFileSync(TEMP_TRACK_PATH, "utf8")) as string[];
  } catch {
    tracked = [];
  }
  const removed: string[] = [];
  for (const path of tracked) {
    try {
      rmSync(path, { force: true });
      removed.push(path);
    } catch {
      // Best effort; a missing file is already the desired end state.
    }
  }
  writeJsonFile(TEMP_TRACK_PATH, []);
  return removed;
}

function quoteEnvValue(value: string): string {
  if (/^[A-Za-z0-9_@./:+-]+$/.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function checkEnvName(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new VaultOperationError("env_name_invalid");
}

function cleanupEphemeral(credentialId: string, grantScope: string) {
  if (grantScope !== "once") return;
  if (deleteIfEphemeral(credentialId)) {
    try {
      logAudit({ at: Date.now(), credentialId, event: "deleted", result: "one-time credential auto-removed after use" });
    } catch {
      // Cleanup is complete; an audit failure must not replace the operation's error.
    }
  }
}

function scrubOutput(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && out.includes(secret)) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return out;
}

export function execWithEnv(input: {
  grantId: string;
  credentialId: string;
  target: string;
  command: string;
  args?: string[];
  envMap: Record<string, string>;
  ownerSessionId?: string;
  operation?: string;
  cwd?: string;
}): { exitCode: number; stdout: string; stderr: string } {
  const credential = getCredential(input.credentialId);
  if (!credential) throw new VaultOperationError("credential_missing");

  const secrets: string[] = [];
  const injected: Record<string, string> = {};
  for (const [envVar, fieldName] of Object.entries(input.envMap)) {
    checkEnvName(envVar);
    if (!credential.fields.some((field) => field.name === fieldName)) throw new VaultOperationError("field_missing");
    const value = getFieldValue(credential, fieldName);
    secrets.push(value);
    injected[envVar] = value;
  }

  // Consume before spawn: a crash must never leave a once-grant replayable.
  const grant = spendGrant({ grantId: input.grantId, credentialId: input.credentialId, target: input.target, tool: "terminal", operation: input.operation ?? "use", agent: "pi", fields: Object.values(input.envMap), ownerSessionId: input.ownerSessionId });
  try {
    const result = spawnSync(input.command, input.args ?? [], {
      encoding: "utf8",
      cwd: input.cwd,
      env: { ...process.env, ...injected },
      timeout: 120_000,
      windowsHide: true,
    });
    if (result.error) throw new VaultOperationError("command_start");

    touchUsed(input.credentialId);
    logAudit({ at: Date.now(), credentialId: input.credentialId, event: "used", grantId: grant.grantId, tool: "terminal", operation: grant.operation, target: grant.target });

    return {
      exitCode: result.status ?? -1,
      stdout: scrubOutput(result.stdout?.toString() ?? "", secrets),
      stderr: scrubOutput(result.stderr?.toString() ?? "", secrets),
    };
  } finally {
    cleanupEphemeral(input.credentialId, grant.scope);
  }
}

export function execWithStdin(input: {
  grantId: string;
  credentialId: string;
  target: string;
  command: string;
  args?: string[];
  field: string;
  ownerSessionId?: string;
  operation?: string;
  cwd?: string;
}): { exitCode: number; stdout: string; stderr: string } {
  const credential = getCredential(input.credentialId);
  if (!credential) throw new VaultOperationError("credential_missing");

  if (!credential.fields.some((field) => field.name === input.field)) throw new VaultOperationError("field_missing");
  const secret = getFieldValue(credential, input.field);
  const grant = spendGrant({ grantId: input.grantId, credentialId: input.credentialId, target: input.target, tool: "terminal", operation: input.operation ?? "use", agent: "pi", fields: [input.field], ownerSessionId: input.ownerSessionId });
  try {
    const result = spawnSync(input.command, input.args ?? [], {
      encoding: "utf8",
      cwd: input.cwd,
      input: `${secret}\n`,
      timeout: 120_000,
      windowsHide: true,
    });
    if (result.error) throw new VaultOperationError("command_start");

    touchUsed(input.credentialId);
    logAudit({ at: Date.now(), credentialId: input.credentialId, event: "used", grantId: grant.grantId, tool: "terminal", operation: grant.operation, target: grant.target });

    return {
      exitCode: result.status ?? -1,
      stdout: scrubOutput(result.stdout?.toString() ?? "", [secret]),
      stderr: scrubOutput(result.stderr?.toString() ?? "", [secret]),
    };
  } finally {
    cleanupEphemeral(input.credentialId, grant.scope);
  }
}

export function writeTempEnvFile(input: {
  grantId: string;
  credentialId: string;
  target: string;
  path: string;
  expectedParent: string;
  entries: Record<string, string>;
  persistent: boolean;
  ownerSessionId?: string;
  operation?: string;
}): { path: string; persistent: boolean } {
  const credential = getCredential(input.credentialId);
  if (!credential) throw new VaultOperationError("credential_missing");

  const lines = Object.entries(input.entries).map(([envVar, fieldName]) => {
    checkEnvName(envVar);
    if (!credential.fields.some((field) => field.name === fieldName)) throw new VaultOperationError("field_missing");
    return `${envVar}=${quoteEnvValue(getFieldValue(credential, fieldName))}`;
  });
  const grant = spendGrant({ grantId: input.grantId, credentialId: input.credentialId, target: input.target, tool: "file", operation: input.operation ?? "use", agent: "pi", fields: Object.values(input.entries), persistent: input.persistent, ownerSessionId: input.ownerSessionId });
  try {
    // Check the parent the UI confirmed immediately before exclusive creation.
    let parent: string;
    try {
      parent = realpathSync(dirname(input.path));
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error) {
        if (error.code === "ENOENT" || error.code === "ENOTDIR") throw new VaultOperationError("parent_missing");
        if (error.code === "EACCES" || error.code === "EPERM") throw new VaultOperationError("parent_access");
      }
      throw error;
    }
    if (parent !== input.expectedParent) throw new VaultOperationError("parent_changed");
    try {
      writeFileSync(input.path, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error) {
        if (error.code === "EEXIST") throw new VaultOperationError("destination_exists");
        if (error.code === "EACCES" || error.code === "EPERM") throw new VaultOperationError("write_permission");
      }
      throw error;
    }
    try {
      chmodSync(input.path, 0o600);
    } catch {
      // Best effort on Windows.
    }
    touchUsed(input.credentialId);
    logAudit({ at: Date.now(), credentialId: input.credentialId, event: "used", grantId: grant.grantId, tool: "file", operation: grant.operation, target: grant.target });
    if (!input.persistent) trackTempFile(input.path);
  } finally {
    cleanupEphemeral(input.credentialId, grant.scope);
  }

  return { path: input.path, persistent: input.persistent };
}

export function removeTempFile(path: string) {
  rmSync(path, { force: true });
}

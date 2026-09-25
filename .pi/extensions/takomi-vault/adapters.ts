import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_ROOT, writeJsonFile } from "./config.ts";
import { deleteIfEphemeral, getCredential, getFieldValue, touchUsed } from "./vault-store.ts";
import { spendGrant } from "./grant-store.ts";
import { logAudit } from "./audit.ts";

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
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Refusing to write invalid env var name: ${name}`);
}

function cleanupEphemeral(credentialId: string, grantScope: string) {
  if (grantScope !== "once") return;
  if (deleteIfEphemeral(credentialId)) {
    logAudit({ at: Date.now(), credentialId, event: "deleted", result: "one-time credential auto-removed after use" });
  }
}

function scrubOutput(text: string, secrets: string[]): string {
  let out = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4 && out.includes(secret)) {
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
  operation?: string;
  cwd?: string;
}): { exitCode: number; stdout: string; stderr: string } {
  const credential = getCredential(input.credentialId);
  if (!credential) throw new Error(`Unknown credential: ${input.credentialId}`);

  const secrets: string[] = [];
  const injected: Record<string, string> = {};
  for (const [envVar, fieldName] of Object.entries(input.envMap)) {
    checkEnvName(envVar);
    const value = getFieldValue(credential, fieldName);
    secrets.push(value);
    injected[envVar] = value;
  }

  // Consume before spawn: a crash must never leave a once-grant replayable.
  const grant = spendGrant({ grantId: input.grantId, credentialId: input.credentialId, target: input.target, tool: "terminal", operation: input.operation ?? "use", agent: "pi", fields: Object.values(input.envMap) });
  try {
    const result = spawnSync(input.command, input.args ?? [], {
      encoding: "utf8",
      cwd: input.cwd,
      env: { ...process.env, ...injected },
      timeout: 120_000,
      windowsHide: true,
    });
    const spawnError = (result as { error?: Error }).error;
    if (spawnError) throw new Error(`Command failed to start: ${spawnError.message}`);

    touchUsed(input.credentialId);
    logAudit({ at: Date.now(), credentialId: input.credentialId, agent: grant.agent, event: "used", target: input.target, result: `env exec ${input.command} exit=${result.status ?? -1}` });

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
  operation?: string;
  cwd?: string;
}): { exitCode: number; stdout: string; stderr: string } {
  const credential = getCredential(input.credentialId);
  if (!credential) throw new Error(`Unknown credential: ${input.credentialId}`);

  const secret = getFieldValue(credential, input.field);
  const grant = spendGrant({ grantId: input.grantId, credentialId: input.credentialId, target: input.target, tool: "terminal", operation: input.operation ?? "use", agent: "pi", fields: [input.field] });
  try {
    const result = spawnSync(input.command, input.args ?? [], {
      encoding: "utf8",
      cwd: input.cwd,
      input: `${secret}\n`,
      timeout: 120_000,
      windowsHide: true,
    });
    const spawnError = (result as { error?: Error }).error;
    if (spawnError) throw new Error(`Command failed to start: ${spawnError.message}`);

    touchUsed(input.credentialId);
    logAudit({ at: Date.now(), credentialId: input.credentialId, agent: grant.agent, event: "used", target: input.target, result: `stdin exec ${input.command} exit=${result.status ?? -1}` });

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
  entries: Record<string, string>;
  persistent: boolean;
  operation?: string;
}): { path: string; persistent: boolean } {
  const credential = getCredential(input.credentialId);
  if (!credential) throw new Error(`Unknown credential: ${input.credentialId}`);

  const lines = Object.entries(input.entries).map(([envVar, fieldName]) => {
    checkEnvName(envVar);
    return `${envVar}=${quoteEnvValue(getFieldValue(credential, fieldName))}`;
  });
  const grant = spendGrant({ grantId: input.grantId, credentialId: input.credentialId, target: input.target, tool: "file", operation: input.operation ?? "use", agent: "pi", fields: Object.values(input.entries), persistent: input.persistent });
  writeFileSync(input.path, `${lines.join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    chmodSync(input.path, 0o600);
  } catch {
    // Best effort on Windows.
  }

  try {
    touchUsed(input.credentialId);
    logAudit({
      at: Date.now(),
      credentialId: input.credentialId,
      agent: grant.agent,
      event: "used",
      target: input.target,
      result: input.persistent ? `permanent env file ${input.path}` : `temporary env file ${input.path}`,
    });
    if (!input.persistent) trackTempFile(input.path);
  } finally {
    cleanupEphemeral(input.credentialId, grant.scope);
  }

  return { path: input.path, persistent: input.persistent };
}

export function removeTempFile(path: string) {
  rmSync(path, { force: true });
}

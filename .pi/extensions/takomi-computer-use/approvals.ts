import { readFile, mkdir, rm } from 'node:fs/promises';
import { writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { isRecord } from './config.js';

type Grant = { server: string; app: string };
type Decision = { action: 'accept' | 'decline' | 'cancel'; content?: Record<string, never>; _meta?: { persist: 'session' | 'always' } };

function emptyForm(params: unknown): params is Record<string, unknown> & { message: string } {
  if (!isRecord(params) || typeof params.message !== 'string' || (params.mode !== undefined && params.mode !== 'form')) return false;
  const schema = params.requestedSchema;
  if (!isRecord(schema) || schema.type !== 'object') return false;
  const supported = ['type', 'properties', 'required', 'additionalProperties', 'title', 'description'];
  if (Object.keys(schema).some(key => !supported.includes(key))) return false;
  if (schema.properties !== undefined && (!isRecord(schema.properties) || Object.keys(schema.properties).length)) return false;
  return schema.required === undefined || (Array.isArray(schema.required) && schema.required.length === 0);
}

function appAccess(params: Record<string, unknown>) {
  const meta = params._meta;
  if (!isRecord(meta) || meta.connector_id !== 'computer-use' || meta.codex_approval_kind !== 'mcp_tool_call' ||
      meta.riskLevel !== 'low' || meta.codex_request_type !== undefined || meta.tool_name !== undefined ||
      !isRecord(meta.tool_params) || typeof meta.tool_params.app !== 'string' || !meta.tool_params.app ||
      meta.tool_params.app === 'computer-audio') return undefined;
  return { app: meta.tool_params.app, scopes: Array.isArray(meta.persist) ? meta.persist : [] };
}

export async function readGrants(file: string): Promise<{ version: 1; apps: Grant[] }> {
  let value: unknown;
  try { value = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (isRecord(error) && error.code === 'ENOENT') return { version: 1, apps: [] }; throw error; }
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.apps)) throw new Error('Invalid app approval file.');
  const apps: Grant[] = [];
  for (const app of value.apps) {
    if (!isRecord(app) || typeof app.server !== 'string' || typeof app.app !== 'string') throw new Error('Invalid app approval entry.');
    apps.push({ server: app.server, app: app.app });
  }
  return { version: 1, apps };
}

async function saveGrant(file: string, grant: Grant, cancelled: () => boolean) {
  await mkdir(path.dirname(file), { recursive: true });
  const unlock = await lockfile.lock(file, { realpath: false, retries: { retries: 3, minTimeout: 50, maxTimeout: 100 } });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    const state = await readGrants(file);
    if (cancelled()) return false;
    if (!state.apps.some(app => app.server === grant.server && app.app === grant.app)) state.apps.push(grant);
    // Commit without an event-loop gap between the cancellation check and atomic rename.
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    renameSync(temporary, file);
    return true;
  } finally {
    try { await rm(temporary, { force: true }); } finally { await unlock(); }
  }
}

export function createApprovalHandler(options: {
  file: string; server: string; getUI: () => ExtensionContext['ui'] | undefined; isActive: () => boolean;
}) {
  let pending: Promise<unknown> = Promise.resolve();
  const sessionApps = new Set<string>();
  return (params: unknown, request: { signal: AbortSignal }): Promise<Decision> => {
    const run = async (): Promise<Decision> => {
      const cancelled = () => request.signal.aborted || !options.isActive();
      if (cancelled()) return { action: 'cancel' };
      const ui = options.getUI();
      if (!emptyForm(params)) {
        ui?.notify('Unsupported MCP form. Only field-free approval requests are supported.', 'warning');
        return { action: 'decline' };
      }
      const app = appAccess(params);
      if (app?.scopes.includes('session') && sessionApps.has(app.app)) {
        return { action: 'accept', content: {}, _meta: { persist: 'session' } };
      }
      let canRemember = app?.scopes.includes('always') === true;
      if (canRemember && app) {
        try {
          const state = await readGrants(options.file);
          if (cancelled()) return { action: 'cancel' };
          if (state.apps.some(grant => grant.server === options.server && grant.app === app.app)) {
            return { action: 'accept', content: {}, _meta: { persist: 'always' } };
          }
        } catch {
          canRemember = false;
          ui?.notify('Cannot read saved app approvals. The Always option is unavailable until the file is fixed.', 'warning');
        }
      }
      if (!ui || cancelled()) return { action: 'cancel' };
      const choices = ['Deny', 'Allow this request'];
      if (app?.scopes.includes('session')) choices.push('Allow for this session');
      if (canRemember) choices.push('Always allow this app');
      const choice = await ui.select(`Desktop app approval\n${params.message}`, choices, { signal: request.signal, timeout: 60000 });
      if (cancelled() || choice === undefined) return { action: 'cancel' };
      if (!choices.includes(choice) || choice === 'Deny') return { action: 'decline' };
      if (choice === 'Allow for this session' && app) {
        sessionApps.add(app.app);
        return { action: 'accept', content: {}, _meta: { persist: 'session' } };
      }
      if (choice === 'Always allow this app' && app) {
        try {
          const saved = await saveGrant(options.file, { server: options.server, app: app.app }, cancelled);
          return saved ? { action: 'accept', content: {}, _meta: { persist: 'always' } } : { action: 'cancel' };
        } catch {
          ui.notify('Could not save app approval. Access was allowed for this request only.', 'warning');
        }
      }
      return cancelled() ? { action: 'cancel' } : { action: 'accept', content: {} };
    };
    const result = pending.then(run);
    pending = result.catch(() => undefined);
    return result;
  };
}

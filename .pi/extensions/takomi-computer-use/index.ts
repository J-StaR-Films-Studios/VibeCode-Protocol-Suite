import type { ExtensionAPI, AgentToolResult } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { computerUsePaths, loadComputerUseConfig, resolveDesktopServer } from './config.js';
import type { connectDesktop } from './client.ts';

type Connection = Awaited<ReturnType<typeof connectDesktop>>;
const USAGE = 'Opt-in Windows desktop control. Keep Codex open and use only one desktop agent at a time. '
  + 'Call action instructions and read the full safety guidance before sending input. '
  + 'JavaScript uses globalThis.sky = (await import("@oai/sky")).sky and nodeRepl.write(...) for output. '
  + 'Select windows from sky.list_windows(), observe before acting, and refresh after each action. '
  + 'Never automate terminals, authentication, password managers, security/privacy settings, or Codex itself. '
  + 'Sensitive actions still require confirmation. App approvals do not authorize those actions.';

export function createComputerUseExtension(options: { home?: string; platform?: string } = {}) {
  return (pi: ExtensionAPI) => {
    const home = options.home ?? homedir();
    const paths = computerUsePaths(home);
    let opening: Promise<Connection> | undefined;
    let controller = new AbortController();
    let calls: Promise<unknown> = Promise.resolve();
    pi.on('session_start', async (_event, ctx) => {
      try {
        controller.abort();
        await opening?.then(connection => connection.client.close(), () => undefined);
        opening = undefined;
        calls = Promise.resolve();
        const config = await loadComputerUseConfig(paths.config);
        if (!config?.enabled) return;
        if ((options.platform ?? process.platform) !== 'win32') {
          ctx.ui.notify('Takomi computer use currently supports Windows only.', 'warning');
          return;
        }
        controller = new AbortController();
        const current = controller;
        const server = await resolveDesktopServer(config, home);
        const [{ connectDesktop, desktopCall }, { createApprovalHandler }] = await Promise.all([
          import('./client.ts'), import('./approvals.ts'),
        ]);
        const approve = createApprovalHandler({ file: paths.approvals, server: server.id,
          getUI: () => ctx.hasUI ? ctx.ui : undefined, isActive: () => !current.signal.aborted });
        opening = connectDesktop(server, approve);
        const connection = await opening;
        if (current.signal.aborted) { await connection.client.close(); return; }
        const guidance = await readFile(new URL('./guidance.md', import.meta.url), 'utf8');
        if (current.signal.aborted) { await connection.client.close(); return; }
        const instructions = `${USAGE}\n\n${guidance}\n\n${connection.client.instructions || ''}`;
        pi.registerTool({
          name: 'takomi_computer_use', label: 'Desktop', description: USAGE,
          namespace: { name: 'takomi_computer_use', description: 'Optional Windows desktop MCP. Use action instructions for the complete guidance.' },
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
          parameters: Type.Object({
            action: Type.Union([Type.Literal('js'), Type.Literal('reset'), Type.Literal('instructions'), Type.Literal('status')]),
            code: Type.Optional(Type.String()), title: Type.Optional(Type.String()),
            timeout_ms: Type.Optional(Type.Number({ minimum: 1 })),
          }),
          async execute(_id, params, signal, onUpdate) {
            if (current.signal.aborted) throw new Error('Computer-use session has ended. Reload Pi to reconnect.');
            if (params.action === 'instructions') return { content: [{ type: 'text', text: instructions }], details: { server: server.name } };
            if (params.action === 'status') return { content: [{ type: 'text', text: JSON.stringify({
              connected: connection.client.connectionState === 'connected', server: server.name, approvals: paths.approvals,
            }) }], details: { server: server.name } };
            const run = async () => {
              if (signal?.aborted || current.signal.aborted) throw new Error('Desktop operation cancelled.');
              if (params.action === 'js' && params.code === undefined) throw new Error('The js action requires code.');
              const tool = params.action === 'reset' ? 'js_reset' : 'js';
              if (!connection.tools.some(entry => entry.name === tool)) throw new Error(`The selected MCP does not offer ${tool}.`);
              const args = tool === 'js' ? { code: params.code, ...(params.title ? { title: params.title } : {}),
                ...(params.timeout_ms ? { timeout_ms: params.timeout_ms } : {}) } : {};
              const result = await desktopCall(connection.client, tool, args, {
                signal, timeoutMs: Math.max(120000, (params.timeout_ms ?? 30000) + 60000),
                onProgress: progress => onUpdate?.({ content: [{ type: 'text', text: progress.message || 'Desktop operation running' }], details: { server: server.name } }),
              });
              const content: AgentToolResult<{ server: string }>['content'] = [];
              for (const block of result.content) {
                if (block.type === 'text') content.push({ type: 'text', text: block.text });
                if (block.type === 'image') content.push({ type: 'image', data: block.data, mimeType: block.mimeType });
              }
              return { content, details: { server: server.name } };
            };
            const result = calls.then(run);
            calls = result.catch(() => undefined);
            return result;
          },
        });
      } catch {
        ctx.ui.notify('Computer use could not start. Run takomi computer-use doctor for a read-only check.', 'warning');
      }
    });
    pi.on('session_shutdown', async () => {
      controller.abort();
      await opening?.then(connection => connection.client.close(), () => undefined);
      opening = undefined;
    });
  };
}

export default createComputerUseExtension();

import { createInterface } from 'node:readline';
import { appendFileSync } from 'node:fs';
const send = message => process.stdout.write(`${JSON.stringify(message)}\n`);
let pending;
const appApproval = { mode: 'form', message: 'Allow access to Test App?', requestedSchema: { type: 'object', properties: {} },
  _meta: { connector_id: 'computer-use', codex_approval_kind: 'mcp_tool_call', riskLevel: 'low',
    persist: ['session', 'always'], tool_params: { app: 'test.desktop.app' } } };
for await (const line of createInterface({ input: process.stdin, crlfDelay: Infinity })) {
  const message = JSON.parse(line);
  if (process.env.TEST_DESKTOP_TRACE) appendFileSync(process.env.TEST_DESKTOP_TRACE, `${JSON.stringify(message)}\n`);
  if (message.id === 'app-access' && message.result && pending !== undefined) {
    send({ jsonrpc: '2.0', id: pending, result: { content: [{ type: 'text', text: message.result.action }], isError: message.result.action !== 'accept' } });
    pending = undefined;
    continue;
  }
  if (message.id === undefined) continue;
  if (message.method === 'initialize') send({ jsonrpc: '2.0', id: message.id, result: {
    protocolVersion: message.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'fake-desktop', version: '1' }, instructions: 'Test server guidance.' } });
  else if (message.method === 'tools/list') send({ jsonrpc: '2.0', id: message.id, result: { tools: ['js', 'js_reset'].map(name => ({ name, inputSchema: { type: 'object' } })) } });
  else if (message.method === 'tools/call') {
    const code = message.params.arguments?.code || '';
    if (code === 'approval') { pending = message.id; send({ jsonrpc: '2.0', id: 'app-access', method: 'elicitation/create', params: appApproval }); }
    else send({ jsonrpc: '2.0', id: message.id, result: { content: [
      { type: 'text', text: code.includes('sky.list_windows') ? JSON.stringify({ windowCount: 2 }) : (code === 'throw' ? 'Simulated desktop failure' : 'ok') },
      ...(code === 'image' ? [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }] : []),
    ], ...(code === 'throw' ? { isError: true } : {}) } });
  } else send({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Unsupported test method' } });
}

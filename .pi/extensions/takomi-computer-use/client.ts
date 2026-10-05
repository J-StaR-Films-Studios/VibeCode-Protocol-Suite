import { McpClient, StdioTransport } from '@earendil-works/pi-mcp';
import type { McpRequestOptions } from '@earendil-works/pi-mcp';
import type { DesktopServer } from './config.js';

export async function connectDesktop(server: DesktopServer, approve: (params: unknown, request: { signal: AbortSignal }) => unknown) {
  const client = new McpClient({ name: 'takomi-computer-use', version: '1.0.0', requestTimeoutMs: 120000,
    capabilities: { elicitation: { form: {} } } });
  client.setRequestHandler('elicitation/create', approve);
  try {
    await client.connect(new StdioTransport({ ...server, stderr: 'pipe' }));
    const tools = await client.listTools();
    if (!tools.some(tool => tool.name === 'js')) throw new Error('The selected MCP does not expose the required js desktop tool.');
    return { client, tools };
  } catch (error) {
    await client.close();
    throw error;
  }
}

export async function desktopCall(client: McpClient, name: string, args: Record<string, unknown>, options: McpRequestOptions = {}) {
  const result = await client.callTool(name, args, options);
  if (result.isError) throw new Error(result.content.filter(block => block.type === 'text').map(block => block.text).join('\n') || 'Desktop operation failed.');
  return result;
}

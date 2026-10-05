import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readCodexRuntime, DESKTOP_USAGE } from './codex-runtime.mjs';

export function decorateResponse(message, instructions) {
  if (message.result?.serverInfo) {
    message.result.serverInfo = { name: 'takomi-codex-desktop', version: '1.0.0' };
    message.result.instructions = `${DESKTOP_USAGE}\n\n${message.result.instructions || ''}\n\n${instructions}`;
  }
  if (Array.isArray(message.result?.tools)) {
    for (const tool of message.result.tools) {
      if (tool.name === 'js') {
        tool.description = `${DESKTOP_USAGE}\n\n${tool.description || ''}`;
        tool.annotations = { ...tool.annotations, readOnlyHint: false, destructiveHint: true, openWorldHint: true };
      }
    }
  }
  return message;
}

export function startDesktopServer(runtime) {
  const child = spawn(runtime.command, runtime.args, { cwd: runtime.cwd, env: runtime.env,
    stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true });
  process.stdin.pipe(child.stdin);
  child.stdin.on('error', error => { if (error.code !== 'EPIPE') console.error(error.message); });
  const output = createInterface({ input: child.stdout, crlfDelay: Infinity });
  output.on('line', line => {
    try {
      process.stdout.write(`${JSON.stringify(decorateResponse(JSON.parse(line), runtime.instructions))}\n`);
    } catch {
      console.error('The Codex runtime returned an invalid MCP message.');
      process.exitCode = 1;
      child.stdin.end();
    }
  });
  child.on('error', () => { console.error('Cannot start the Codex desktop runtime.'); process.exitCode = 1; });
  child.on('exit', code => {
    process.exitCode = code ?? 1;
    process.stdin.unpipe(child.stdin);
    process.stdin.pause();
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.stdin.end());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.platform !== 'win32') throw new Error('This desktop launcher currently supports Windows only.');
    const { values } = parseArgs({ options: { 'codex-cli': { type: 'string' } } });
    startDesktopServer(readCodexRuntime({ cliPath: values['codex-cli'] }));
  } catch (error) {
    console.error(error.message.split('\n')[0]);
    process.exitCode = 1;
  }
}

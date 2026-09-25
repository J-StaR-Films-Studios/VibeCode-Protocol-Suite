import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const originalHash = '65f4cad71bb0b5d9320ddac1de42745e08bf59177cd2b22e7f2301af6a7bdc0e';
const patchedHash = '8daed7c661fb66c71bf5e2841c8ce29c960ac0198ebf090925421b6c5657d4cc';
export function patchPiSubagentsRenderer(rendererPath = resolve(import.meta.dirname, '..', 'node_modules', 'pi-subagents', 'src', 'tui', 'render.ts')) {
  const source = readFileSync(rendererPath, 'utf8');
  const hash = (text) => createHash('sha256').update(text).digest('hex');
  if (hash(source) === patchedHash) return;
  if (hash(source) !== originalHash) throw new Error(`Unknown pi-subagents renderer at ${rendererPath}. Cannot apply the Takomi compact-widget patch.`);

  const header = 'function widgetParallelAgentDetails(job: AsyncJobState, theme: Theme, expanded = false, width = getTermWidth()): string[] {\n\tif (!job.steps?.length) return [];';
  const compactStart = source.indexOf('function compactSingleWidgetLines(');
  const compactEnd = source.indexOf('type WidgetRenderTier =', compactStart);
  if (!source.includes(header) || compactStart < 0 || compactEnd < 0) throw new Error('pi-subagents compact-widget patch markers are missing.');
  const compact = `function compactSingleWidgetLines(job: AsyncJobState, theme: Theme, width: number): string[] {
\tconst lines = buildSingleWidgetLines(job, theme, width, false);
\tif (!job.steps?.length) return lines;
\treturn [lines[0]!, \`\${lines[1]} \${theme.fg("dim", \`· \${job.status}\`)}\`, theme.fg("dim", "  Ctrl+O for live detail")].map((line) => truncLine(line, width));
}

`;
  const result = source.replace(header, header.replace('if (!job.steps?.length)', 'if (!expanded || !job.steps?.length)'));
  const updated = result.slice(0, result.indexOf('function compactSingleWidgetLines(')) + compact + result.slice(result.indexOf('type WidgetRenderTier ='));
  if (hash(updated) !== patchedHash) throw new Error('pi-subagents compact-widget patch did not match its expected output.');
  writeFileSync(rendererPath, updated);
}

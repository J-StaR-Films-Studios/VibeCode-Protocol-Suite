export type ComputerUseConfig = {
  version: 1;
  enabled: boolean;
  source: { kind: 'codex'; cliPath?: string } | { kind: 'existing'; name: string };
};
export type DesktopServer = { name: string; command: string; args: string[]; env: Record<string, string>; cwd: string; id: string };
export function computerUsePaths(home?: string): { home: string; config: string; approvals: string; mcp: string; launcher: string };
export function isRecord(value: unknown): value is Record<string, unknown>;
export function loadComputerUseConfig(file: string): Promise<ComputerUseConfig | null>;
export function parseDesktopServer(value: unknown, name: string, home: string, environment?: NodeJS.ProcessEnv): DesktopServer;
export function resolveDesktopServer(config: ComputerUseConfig, home?: string): Promise<DesktopServer>;

export function collectTakomiStats(opts?: { home?: string; cwd?: string; json?: boolean; limit?: number }): Promise<any>;
export function renderTakomiStats(stats: any, opts?: { limit?: number }): string;
export function printTakomiStats(options?: { home?: string; cwd?: string; json?: boolean; limit?: number }): Promise<void>;

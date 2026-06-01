export function collectTakomiStats(opts?: { home?: string; cwd?: string; json?: boolean; limit?: number; view?: string; since?: string }): Promise<any>;
export function renderTakomiStats(stats: any, opts?: { limit?: number; view?: string }): string;
export function printTakomiStats(options?: { home?: string; cwd?: string; json?: boolean; limit?: number; view?: string; since?: string }): Promise<void>;

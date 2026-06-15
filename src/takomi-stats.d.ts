export function collectTakomiStats(opts?: { home?: string; cwd?: string; json?: boolean; full?: boolean; limit?: number; view?: string; since?: string }): Promise<any>;
export function renderTakomiStats(stats: any, opts?: { full?: boolean; limit?: number; view?: string; since?: string }): string;
export function printTakomiStats(options?: { home?: string; cwd?: string; json?: boolean; full?: boolean; limit?: number; view?: string; since?: string }): Promise<void>;

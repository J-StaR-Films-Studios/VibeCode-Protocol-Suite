import { existsSync, readFileSync } from "node:fs";
import { CREDENTIALS_PATH, withJsonFileLock, writeJsonFile } from "./config.ts";
import type { RouterCredentialStore, StoredRouterAccount } from "./types.ts";

const EMPTY_STORE: RouterCredentialStore = {
  version: 1,
  accounts: [],
};

function normalizeAccount(account: StoredRouterAccount): StoredRouterAccount {
  return {
    ...account,
    enabled: account.enabled !== false,
    weight: Number.isFinite(account.weight) && account.weight > 0 ? Math.floor(account.weight) : 1,
    refresh: account.refresh ?? "",
    access: account.access ?? "",
    expires: Number.isFinite(account.expires) ? account.expires : Number.MAX_SAFE_INTEGER,
    createdAt: Number.isFinite(account.createdAt) ? account.createdAt : Date.now(),
    updatedAt: Number.isFinite(account.updatedAt) ? account.updatedAt : Date.now(),
    meta: account.meta ?? {},
  };
}

export function redactToken(token: string): string {
  if (!token) return "<empty>";
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export function summarizeAccount(account: StoredRouterAccount) {
  return {
    id: account.id,
    label: account.label,
    provider: account.provider,
    upstreamId: account.upstreamId,
    enabled: account.enabled,
    weight: account.weight,
    expires: account.expires,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    access: redactToken(account.access),
    refresh: redactToken(account.refresh),
    meta: account.meta ?? {},
  };
}

export class RouterAccountStore {
  private data: RouterCredentialStore;

  constructor() {
    this.data = this.load();
  }

  private load(): RouterCredentialStore {
    if (!existsSync(CREDENTIALS_PATH)) {
      writeJsonFile(CREDENTIALS_PATH, EMPTY_STORE, true);
      return { ...EMPTY_STORE, accounts: [] };
    }

    try {
      const parsed = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as Partial<RouterCredentialStore>;
      return {
        version: 1,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts.map((account) => normalizeAccount(account)) : [],
      };
    } catch {
      writeJsonFile(CREDENTIALS_PATH, EMPTY_STORE, true);
      return { ...EMPTY_STORE, accounts: [] };
    }
  }

  private save() {
    writeJsonFile(CREDENTIALS_PATH, this.data, true);
  }

  private mutate(fn: () => void) {
    withJsonFileLock(CREDENTIALS_PATH, () => {
      this.data = this.load();
      fn();
      this.save();
    });
  }

  reload() {
    this.data = this.load();
  }

  list(): StoredRouterAccount[] {
    return [...this.data.accounts].sort((a, b) => a.createdAt - b.createdAt);
  }

  get(id: string): StoredRouterAccount | undefined {
    return this.data.accounts.find((account) => account.id === id);
  }

  add(account: StoredRouterAccount) {
    this.mutate(() => {
      this.data.accounts.push(normalizeAccount(account));
    });
  }

  update(account: StoredRouterAccount) {
    this.mutate(() => {
      const index = this.data.accounts.findIndex((item) => item.id === account.id);
      if (index === -1) throw new Error(`Unknown account: ${account.id}`);
      this.data.accounts[index] = normalizeAccount(account);
    });
  }

  remove(id: string) {
    this.mutate(() => {
      this.data.accounts = this.data.accounts.filter((account) => account.id !== id);
    });
  }

  rename(id: string, label: string) {
    const account = this.get(id);
    if (!account) throw new Error(`Unknown account: ${id}`);
    const nextLabel = label.trim();
    if (!nextLabel) throw new Error("Account label cannot be empty");
    account.label = nextLabel;
    account.updatedAt = Date.now();
    this.update(account);
  }

  setEnabled(id: string, enabled: boolean) {
    const account = this.get(id);
    if (!account) throw new Error(`Unknown account: ${id}`);
    account.enabled = enabled;
    account.updatedAt = Date.now();
    this.update(account);
  }

  setWeight(id: string, weight: number) {
    const account = this.get(id);
    if (!account) throw new Error(`Unknown account: ${id}`);
    account.weight = Math.max(1, Math.floor(weight));
    account.updatedAt = Date.now();
    this.update(account);
  }
}

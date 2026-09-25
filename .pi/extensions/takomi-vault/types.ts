export type CredentialType = "login" | "token";
export type FieldVisibility = "agent-readable" | "inject-only";
export type GrantScope = "once" | "turn" | "session" | "target";
export type KeyBackend = "windows-dpapi" | "macos-keychain" | "linux-secret-tool" | "passphrase" | "file-permissions";

export interface VaultField {
  name: string;
  visibility: FieldVisibility;
  valueEnc: EncryptedBlob;
}

export interface EncryptedBlob {
  iv: string;
  tag: string;
  data: string;
}

export interface StoredCredential {
  id: string;
  label: string;
  service: string;
  host: string;
  type: CredentialType;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  fields: VaultField[];
}

export interface CredentialStoreFile {
  version: 1;
  credentials: StoredCredential[];
}

export interface CredentialGrant {
  grantId: string;
  credentialId: string;
  agent: string;
  tool: string;
  target: string;
  operation: string;
  /** Absent on v1 grants: all credential fields remain available. */
  fields?: string[];
  scope: GrantScope;
  expiresAt: number;
  revoked: boolean;
  createdAt: number;
  useCount: number;
}

export interface GrantStoreFile {
  version: 1;
  grants: CredentialGrant[];
}

export interface AuditEvent {
  at: number;
  credentialId?: string;
  agent?: string;
  event: "requested" | "approved" | "denied" | "used" | "expired" | "revoked" | "created" | "deleted" | "renamed" | "revealed";
  grantId?: string;
  scope?: GrantScope;
  tool?: "terminal" | "file";
  operation?: string;
  target?: string;
  result?: string;
}

export interface CredentialSummary {
  id: string;
  label: string;
  service: string;
  host: string;
  type: CredentialType;
  fieldNames: string[];
  createdAt: number;
  lastUsedAt?: number;
}

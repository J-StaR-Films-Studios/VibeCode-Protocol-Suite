const OPERATION_MESSAGES = {
  grant_missing: "Grant not found. Request a new grant.",
  grant_revoked: "Grant was revoked. Request a new grant.",
  grant_expired: "Grant expired. Request a new grant.",
  target_mismatch: "Target does not match the approved host. Pass the issued target, not terminal or file.",
  tool_mismatch: "Tool does not match the grant. Use the approved terminal or file tool, or request a new grant.",
  agent_mismatch: "Agent does not match the grant. Request a grant for this agent.",
  operation_mismatch: "Operation does not match the grant. Pass the exact issued operation; omitting it means use.",
  fields_denied: "Grant does not allow the requested fields. Use approved stored field names or request a new grant.",
  owner_unavailable: "This host cannot identify the chat. Choose one attempt or explicitly remember across chats.",
  owner_mismatch: "Grant belongs to another chat. Request approval in this chat.",
  legacy_reapproval: "Legacy chat grant has no trusted owner. Request approval again.",
  approval_cancelled: "Vault approval cancelled because the chat changed or the request ended.",
  grant_spent: "Single-use grant is spent. Request a new grant; failed attempts after spending cannot be retried with it.",
  credential_mismatch: "Grant belongs to a different credential. Pass the issued credential ID.",
  persistent_scope: "Permanent file writes need a session or target grant. Request approval or use a temporary file.",
  credential_missing: "Credential not found. Request a new credential grant.",
  field_missing: "Stored field not found. Check the credential's field names.",
  env_name_invalid: "Invalid environment variable name. Use letters, digits and underscores, starting with a letter or underscore.",
  command_start: "Command failed to start. Check the executable and working directory. Once grants cannot retry an admitted attempt; reusable grants remain valid.",
  parent_missing: "Destination parent does not exist. Choose an existing directory.",
  parent_access: "Destination parent cannot be accessed. Check directory permissions.",
  parent_changed: "Destination parent changed after confirmation. Confirm the destination again with a new grant if needed.",
  destination_exists: "Destination already exists. Choose a new file; existing files and symlinks are not overwritten. Once grants cannot retry an admitted attempt; reusable grants remain valid.",
  write_permission: "File creation was denied by filesystem permissions. Check the destination permissions. Once grants cannot retry an admitted attempt; reusable grants remain valid.",
} as const;

export type VaultOperationReason = keyof typeof OPERATION_MESSAGES;

/** Only fixed public messages, never exception text or request values. */
export class VaultOperationError extends Error {
  readonly reason: VaultOperationReason;

  constructor(reason: VaultOperationReason) {
    super(OPERATION_MESSAGES[reason]);
    this.reason = reason;
    this.name = "VaultOperationError";
  }

  get publicMessage(): string {
    return OPERATION_MESSAGES[this.reason];
  }
}

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

interface GrantBase {
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

export type CredentialGrant =
  | (GrantBase & { policyVersion?: never; ownerSessionId?: never })
  | (GrantBase & { policyVersion: 2; fields: string[]; tool: "terminal" | "file" } & (
      | { scope: "session" | "turn"; ownerSessionId: string }
      | { scope: "once" | "target"; ownerSessionId?: never }
    ));

export interface GrantStoreFile {
  version: 1 | 2;
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

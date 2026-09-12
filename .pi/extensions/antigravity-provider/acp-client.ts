import { spawn, type ChildProcess } from "node:child_process";

/**
 * Minimal ND-JSON JSON-RPC 2.0 client for ACP agents.
 *
 * Mirrors the wire format T3's effect-acp uses (`RpcSerialization.ndJsonRpc()`):
 * one JSON object per line on stdio, `{ jsonrpc: "2.0", id, method, params }`
 * out, `{ jsonrpc: "2.0", id, result | error }` back, plus inbound requests
 * (e.g. `session/request_permission`) and notifications (`session/update`).
 */

export interface AcpSpawnOptions {
  executablePath: string;
  harnessPath: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

export type AcpNotificationHandler = (params: unknown) => void;
export type AcpRequestHandler = (params: unknown) => unknown | Promise<unknown>;

const REQUEST_TIMEOUT_MS = 120_000;
const MAX_STDERR_BYTES = 64 * 1024;

export class AcpError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "AcpError";
    this.code = code;
  }
}

export class AcpClient {
  private child: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, PendingRequest>();
  private notificationHandlers = new Map<string, Set<AcpNotificationHandler>>();
  private requestHandlers = new Map<string, AcpRequestHandler>();
  private stdoutBuffer = "";
  private stderrTail = "";
  private stderrBytes = 0;
  private killed = false;
  private exitCode: number | null = null;
  private exitListeners = new Set<(code: number | null) => void>();

  private constructor(child: ChildProcess) {
    this.child = child;
    child.stdout?.on("data", (data: Buffer) => this.onStdout(data));
    child.stderr?.on("data", (data: Buffer) => this.onStderr(data));
    child.on("error", (err) => this.failAllPending(new AcpError(`ACP process error: ${err.message}`)));
    child.on("exit", (code) => {
      this.exitCode = code;
      for (const listener of this.exitListeners) listener(code);
      if (!this.killed) {
        this.failAllPending(
          new AcpError(
            `ACP server exited with code ${code}. Stderr: ${this.stderrTail.slice(-300) || "none"}`,
          ),
        );
      }
    });
  }

  static launch(options: AcpSpawnOptions): AcpClient {
    const args = process.platform === "linux" ? ["--uid="] : [];
    const child = spawn(options.executablePath, args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...(options.env ?? process.env),
        ANTIGRAVITY_HARNESS_PATH: options.harnessPath,
      },
    });
    return new AcpClient(child);
  }

  get pid(): number | undefined {
    return this.child.pid;
  }

  onExit(listener: (code: number | null) => void): () => void {
    this.exitListeners.add(listener);
    if (this.exitCode !== null) listener(this.exitCode);
    return () => {
      this.exitListeners.delete(listener);
    };
  }

  onNotification(method: string, handler: AcpNotificationHandler): () => void {
    let set = this.notificationHandlers.get(method);
    if (!set) {
      set = new Set();
      this.notificationHandlers.set(method, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** Handle inbound requests from the agent (permission prompts, elicitation). */
  onRequest(method: string, handler: AcpRequestHandler): () => void {
    this.requestHandlers.set(method, handler);
    return () => {
      if (this.requestHandlers.get(method) === handler) this.requestHandlers.delete(method);
    };
  }

  request(method: string, params?: unknown, timeoutMs = REQUEST_TIMEOUT_MS): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      // timeoutMs <= 0 means no client-side timeout (long agent turns).
      let timer: NodeJS.Timeout | undefined;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new AcpError(`ACP request '${method}' timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        // Avoid leaking the timer past process lifetime.
        timer.unref?.();
      }
      this.pending.set(id, { resolve, reject, ...(timer ? { timer } : {}) });
      try {
        this.write({ jsonrpc: "2.0", id, method, params: params ?? {} });
      } catch (error) {
        this.pending.delete(id);
        if (timer) clearTimeout(timer);
        reject(error);
      }
    });
  }

  notify(method: string, params?: unknown): void {
    this.write({ jsonrpc: "2.0", method, params: params ?? {} });
  }

  kill(): void {
    this.killed = true;
    for (const [, pending] of this.pending) {
      if (pending.timer) clearTimeout(pending.timer);
      pending.reject(new AcpError("ACP client shut down"));
    }
    this.pending.clear();
    try {
      this.child.stdin?.destroy();
      this.child.stdout?.destroy();
      this.child.stderr?.destroy();
    } catch {
      // Best-effort teardown.
    }
    try {
      this.child.kill();
    } catch {
      // Already exited.
    }
    this.child.unref?.();
  }

  private write(message: unknown): void {
    if (!this.child.stdin?.writable) {
      throw new AcpError("ACP server stdin is not writable (process may have exited)");
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private onStdout(data: Buffer): void {
    this.stdoutBuffer += data.toString("utf8");
    let newline: number;
    while ((newline = this.stdoutBuffer.indexOf("\n")) !== -1) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line) continue;
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(line) as Record<string, unknown>;
      } catch {
        // Non-JSON stdout (e.g. the Google sign-in URL prefix T3 filters).
        // Keep it out of the protocol stream; it stays in stderrTail context.
        continue;
      }
      this.dispatch(message);
    }
  }

  private onStderr(data: Buffer): void {
    const text = data.toString("utf8");
    this.stderrTail += text;
    this.stderrBytes += text.length;
    if (this.stderrBytes > MAX_STDERR_BYTES) {
      this.stderrTail = this.stderrTail.slice(-MAX_STDERR_BYTES);
      this.stderrBytes = this.stderrTail.length;
    }
  }

  private dispatch(message: Record<string, unknown>): void {
    // Response to our request.
    if ((typeof message.id === "number" || typeof message.id === "string") && ("result" in message || "error" in message)) {
      const pending = this.pending.get(message.id as number);
      if (!pending) return;
      this.pending.delete(message.id as number);
      clearTimeout(pending.timer);
      if ("error" in message && message.error !== undefined) {
        const err = message.error as { code?: number; message?: string };
        pending.reject(
          new AcpError(`ACP error: ${err.message ?? "unknown"}`, err.code),
        );
      } else {
        pending.resolve(message.result);
      }
      return;
    }
    // Inbound request from the agent.
    if (typeof message.method === "string" && "id" in message && message.id !== undefined) {
      const handler = this.requestHandlers.get(message.method);
      if (!handler) {
        this.write({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: `Method not found: ${message.method}` },
        });
        return;
      }
      void Promise.resolve()
        .then(() => handler(message.params))
        .then(
          (result) => this.write({ jsonrpc: "2.0", id: message.id, result: result ?? {} }),
          (error) =>
            this.write({
              jsonrpc: "2.0",
              id: message.id,
              error: {
                code: -32603,
                message: error instanceof Error ? error.message : String(error),
              },
            }),
        );
      return;
    }
    // Notification from the agent.
    if (typeof message.method === "string") {
      const handlers = this.notificationHandlers.get(message.method);
      if (handlers) {
        for (const handler of [...handlers]) {
          try {
            handler(message.params);
          } catch {
            // Handler errors must not break the dispatch loop.
          }
        }
      }
    }
  }

  private failAllPending(error: Error): void {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

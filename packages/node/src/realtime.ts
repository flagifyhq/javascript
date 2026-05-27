import { FlagifyHttpClient, FlagifyAuthError } from "./api/httpClient";
import { debugLog } from "./debug";

export interface RealtimeEvents {
  onFlagChange: (event: FlagChangeEvent) => void;
  onConnected: () => void;
  onReconnected: () => void;
  onInitialSync: (flags: unknown[]) => void;
  onError: (error: Error) => void;
}

export interface RealtimeOptions {
  /** Watchdog timeout: if no bytes received for this long, force a reconnect. */
  idleTimeoutMs?: number;
  /** Base backoff delay in ms. */
  reconnectBaseMs?: number;
  /** Max backoff delay in ms. */
  reconnectMaxMs?: number;
}

export interface FlagChangeEvent {
  environmentId: string;
  flagKey: string;
  action: "updated" | "created" | "archived";
}

const DEFAULT_IDLE_TIMEOUT_MS = 45_000;
const DEFAULT_RECONNECT_BASE_MS = 1_000;
const DEFAULT_RECONNECT_MAX_MS = 30_000;
const WATCHDOG_CHECK_INTERVAL_MS = 10_000;
// A connection must survive this long before we reset the backoff counter.
// Prevents tight reconnection loops when the server drops right after initial_sync.
const HEALTHY_CONNECTION_GRACE_MS = 5_000;

/** Status codes that will never succeed on retry with the same credentials. */
const NON_RETRYABLE_CODES = new Set([401, 403]);

export class RealtimeListener {
  private controller: AbortController | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private hasConnectedBefore = false;
  private permanentFailure = false;
  private destroyed = false;
  private serverRetryMs: number | null = null;
  private lastActivityAt = 0;
  private isStreaming = false;

  private readonly idleTimeoutMs: number;
  private readonly reconnectBaseMs: number;
  private readonly reconnectMaxMs: number;

  constructor(
    private readonly httpClient: FlagifyHttpClient,
    private readonly events: RealtimeEvents,
    options: RealtimeOptions = {},
  ) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.reconnectBaseMs = options.reconnectBaseMs ?? DEFAULT_RECONNECT_BASE_MS;
    this.reconnectMaxMs = options.reconnectMaxMs ?? DEFAULT_RECONNECT_MAX_MS;
  }

  connect(): void {
    if (this.permanentFailure || this.destroyed) return;

    // Debounce: if a healthy stream is already running, ignore duplicate connects.
    if (this.controller && this.isStreaming) {
      console.warn(
        "[Flagify] connect() called while a stream is already active — ignoring.",
      );
      return;
    }

    this.teardown();
    this.controller = new AbortController();
    this.startWatchdog();
    this.stream(this.controller.signal);
  }

  /**
   * Disconnects permanently and resets all reconnection state. Terminal —
   * call this from `client.destroy()`. After this, any in-flight watchdog
   * or stream callback that resolves later will see `destroyed = true` and
   * bail out instead of resurrecting the listener.
   */
  disconnect(): void {
    this.destroyed = true;
    this.teardown();
    this.reconnectAttempts = 0;
    this.hasConnectedBefore = false;
    this.serverRetryMs = null;
  }

  /**
   * Tears down the current stream (controller + timers) without resetting
   * reconnection state. Used between automatic reconnection attempts.
   */
  private teardown(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.isStreaming = false;
  }

  /**
   * Starts a silence watchdog. If no bytes (not even heartbeat comments)
   * arrive within `idleTimeoutMs`, the current stream is aborted and a
   * reconnect is scheduled. Protects against zombie TCP connections where
   * the socket stays open but no data flows.
   */
  private startWatchdog(): void {
    this.lastActivityAt = Date.now();
    this.watchdogTimer = setInterval(() => {
      if (this.destroyed) return;
      if (Date.now() - this.lastActivityAt > this.idleTimeoutMs) {
        debugLog.warn(
          `[Flagify] SSE idle for >${this.idleTimeoutMs}ms — forcing reconnect.`,
        );
        if (this.controller) {
          this.controller.abort();
        }
        // isStreaming is owned by stream()'s finally block — the abort
        // above propagates to reader.read(), the catch runs, finally
        // resets the flag. No inline write here.
        this.scheduleReconnect();
      }
    }, WATCHDOG_CHECK_INTERVAL_MS);
  }

  private async stream(signal: AbortSignal): Promise<void> {
    let connectedAt = 0;
    try {
      this.isStreaming = true;
      const res = await fetch(
        `${this.httpClient.baseUrl}/v1/eval/flags/stream`,
        {
          method: "GET",
          headers: {
            ...this.httpClient.headers,
            Accept: "text/event-stream",
          },
          signal,
        },
      );

      if (!res.ok) {
        if (NON_RETRYABLE_CODES.has(res.status)) {
          throw new FlagifyAuthError(
            `[Flagify] Authentication failed (${res.status}). Realtime sync disabled. Check your publicKey.`,
            res.status,
          );
        }
        throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("SSE response has no body");
      }

      // Drop the server-suggested retry floor so we re-learn from
      // the new stream. Don't reset reconnectAttempts yet — see below.
      connectedAt = Date.now();
      this.serverRetryMs = null;
      this.lastActivityAt = connectedAt;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (this.destroyed) break;
        const { done, value } = await reader.read();
        if (done) break;

        // Any incoming bytes (including heartbeat comments) count as proof of life.
        this.lastActivityAt = Date.now();

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (this.destroyed) break;
          this.parseSSEFrame(part);
        }
      }

      // Stream ended normally — reconnect unless we've been torn down.
      if (!signal.aborted && !this.destroyed) {
        this.resetBackoffIfHealthy(connectedAt);
        this.scheduleReconnect();
      }
    } catch (err) {
      if (signal.aborted || this.destroyed) return;

      const error = err instanceof Error ? err : new Error(String(err));
      this.events.onError(error);

      // Don't retry auth errors — they won't self-heal
      if (err instanceof FlagifyAuthError) {
        this.permanentFailure = true;
        console.error(error.message);
        return;
      }

      this.resetBackoffIfHealthy(connectedAt);
      this.scheduleReconnect();
    } finally {
      this.isStreaming = false;
    }
  }

  private parseSSEFrame(frame: string): void {
    let eventType = "";
    const dataLines: string[] = [];

    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        dataLines.push(line.slice(6));
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5));
      } else if (line.startsWith("retry:")) {
        // SSE `retry:` field — server-suggested reconnection delay in ms.
        const raw = line.slice("retry:".length).trimStart();
        const ms = Number.parseInt(raw, 10);
        if (Number.isFinite(ms) && ms >= 0) {
          this.serverRetryMs = ms;
        }
      }
      // Ignore comment lines (heartbeat `: heartbeat`)
    }

    const data = dataLines.join("\n").trim();

    if (eventType === "connected") {
      if (this.hasConnectedBefore) {
        this.events.onReconnected();
      } else {
        this.hasConnectedBefore = true;
        this.events.onConnected();
      }
      return;
    }

    if (eventType === "initial_sync" && data) {
      try {
        const flags = JSON.parse(data) as unknown[];
        this.events.onInitialSync(flags);
      } catch {
        console.warn("[Flagify] Failed to parse initial_sync event:", data);
      }
      return;
    }

    if (eventType === "flag_change" && data) {
      try {
        const parsed = JSON.parse(data) as FlagChangeEvent;
        this.events.onFlagChange(parsed);
      } catch {
        console.warn("[Flagify] Failed to parse SSE event:", data);
      }
    }
  }

  private resetBackoffIfHealthy(connectedAt: number): void {
    if (connectedAt > 0 && Date.now() - connectedAt >= HEALTHY_CONNECTION_GRACE_MS) {
      this.reconnectAttempts = 0;
      this.serverRetryMs = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.permanentFailure) return;

    // Stop the current watchdog — a new one starts on the next connect().
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    // Don't double-schedule if a reconnect is already pending.
    if (this.reconnectTimer) return;

    const exponential = Math.min(
      this.reconnectBaseMs * Math.pow(2, this.reconnectAttempts),
      this.reconnectMaxMs,
    );
    // Jitter to 50%-100% of the exponential value to avoid thundering herd
    // when a fleet of clients reconnects simultaneously.
    const jittered = exponential * (0.5 + Math.random() * 0.5);
    // Honor the server-suggested retry delay as a floor when present.
    const delay = Math.max(jittered, this.serverRetryMs ?? 0);

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed) return;
      this.connect();
    }, delay);
  }
}

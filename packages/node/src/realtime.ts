import { FlagifyHttpClient } from "./api/httpClient";

export interface RealtimeEvents {
  onFlagChange: (event: FlagChangeEvent) => void;
  onConnected: () => void;
  onError: (error: Error) => void;
}

export interface FlagChangeEvent {
  environmentId: string;
  flagKey: string;
  action: "updated" | "created" | "archived";
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

export class RealtimeListener {
  private controller: AbortController | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly httpClient: FlagifyHttpClient,
    private readonly events: RealtimeEvents,
  ) {}

  connect(): void {
    this.disconnect();
    this.controller = new AbortController();
    this.stream(this.controller.signal);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.reconnectAttempts = 0;
  }

  private async stream(signal: AbortSignal): Promise<void> {
    try {
      const res = await fetch(
        `${this.httpClient.baseUrl}/v1/eval/flags/stream`,
        {
          method: "GET",
          headers: this.httpClient.headers,
          signal,
        },
      );

      if (!res.ok) {
        throw new Error(`SSE connection failed: ${res.status} ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error("SSE response has no body");
      }

      this.reconnectAttempts = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          this.parseSSEFrame(part);
        }
      }

      // Stream ended normally — reconnect
      if (!signal.aborted) {
        this.scheduleReconnect();
      }
    } catch (err) {
      if (signal.aborted) return;

      const error = err instanceof Error ? err : new Error(String(err));
      this.events.onError(error);
      this.scheduleReconnect();
    }
  }

  private parseSSEFrame(frame: string): void {
    let eventType = "";
    let data = "";

    for (const line of frame.split("\n")) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        data = line.slice(6).trim();
      }
      // Ignore comment lines (heartbeat `: heartbeat`)
    }

    if (eventType === "connected") {
      this.events.onConnected();
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

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}

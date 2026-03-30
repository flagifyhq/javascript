import "dotenv/config";

import { createHttpClient, FlagifyHttpClient } from "./api/httpClient";
import { RealtimeListener } from "./realtime";
import { IFlagifyClient } from "./types/FlagifyClient";
import { FlagifyFlaggy } from "./types/FlagifyFlaggy";
import { FlagifyOptions } from "./types/FlagifyTypes";

type CachedFlag = {
  flag: FlagifyFlaggy;
  lastFetchedAt: number;
};

export class Flagify implements IFlagifyClient {
  private flagCache: Map<string, CachedFlag> = new Map();
  private httpClient: FlagifyHttpClient;
  private realtime: RealtimeListener | null = null;

  constructor(private readonly config: FlagifyOptions) {
    this.validateConfig();
    this.httpClient = createHttpClient(config);
    this.syncFlags();

    if (this.config.options?.realtime) {
      this.setupRealtimeListener();
    }
  }

  getValue<T = unknown>(flagKey: string): T {
    const cached = this.flagCache.get(flagKey);

    if (!cached) return undefined as T;

    if (this.isStale(cached)) {
      this.refetchFlag(flagKey);
      return cached.flag.defaultValue as T;
    }

    return cached.flag.enabled
      ? (cached.flag.defaultValue as T)
      : (undefined as T);
  }

  isEnabled(flagKey: string): boolean {
    const cached = this.flagCache.get(flagKey);

    if (!cached) return false;

    if (this.isStale(cached)) {
      this.refetchFlag(flagKey);
      return Boolean(cached.flag.defaultValue); // fallback
    }

    if (cached.flag.type !== "boolean") return false;
    return cached.flag.enabled ? Boolean(cached.flag.defaultValue) : false;
  }

  /**
   * Disconnects the realtime listener and cleans up resources.
   */
  destroy(): void {
    if (this.realtime) {
      this.realtime.disconnect();
      this.realtime = null;
    }
  }

  private isStale(cached: CachedFlag): boolean {
    const staleTime = this.config.options?.staleTimeMs;

    if (typeof staleTime !== "number") {
      return false;
    }

    return Date.now() - cached.lastFetchedAt > staleTime;
  }

  private async refetchFlag(flagKey: string) {
    try {
      const fresh = await this.httpClient.get<FlagifyFlaggy>(
        `/v1/eval/flags/${flagKey}`,
      );
      this.flagCache.set(flagKey, {
        flag: fresh,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      console.warn(`[Flagify] Failed to refetch flag "${flagKey}":`, err);
    }
  }

  private async syncFlags() {
    try {
      const flags = await this.httpClient.get<FlagifyFlaggy[]>(`/v1/eval/flags`);

      for (const flag of flags) {
        this.flagCache.set(flag.key, {
          flag,
          lastFetchedAt: Date.now(),
        });
      }
    } catch (err) {
      console.warn(`[Flagify] Failed to sync flags: ${err}`);
    }
  }

  private validateConfig() {
    const missing: string[] = [];

    if (!this.config.publicKey) {
      missing.push("publicKey");
    }

    if (!this.config.projectKey) {
      missing.push("projectKey");
    }

    if (missing.length > 0) {
      console.error(
        `[Flagify] Missing required config keys: ${missing.join(", ")}`,
        "All feature flags will be disabled.",
      );
    }
  }

  private setupRealtimeListener() {
    this.realtime = new RealtimeListener(this.httpClient, {
      onConnected: () => {
        console.info("[Flagify] Realtime connected");
      },
      onFlagChange: (event) => {
        console.debug(`[Flagify] Flag changed: ${event.flagKey} (${event.action})`);
        this.refetchFlag(event.flagKey);
      },
      onError: (error) => {
        console.warn("[Flagify] Realtime error (will reconnect):", error.message);
      },
    });

    this.realtime.connect();
  }
}

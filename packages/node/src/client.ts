import { createHttpClient, FlagifyHttpClient } from "./api/httpClient";
import { RealtimeListener, FlagChangeEvent } from "./realtime";
import { IFlagifyClient } from "./types/FlagifyClient";
import { FlagifyFlaggy } from "./types/FlagifyFlaggy";
import { FlagifyOptions } from "./types/FlagifyTypes";
import { FlagifyUser } from "./types/FlagifyUser";

export interface EvaluateResult {
  key: string;
  value: unknown;
  reason: "targeting_rule" | "rollout" | "default" | "disabled";
}

type CachedFlag = {
  flag: FlagifyFlaggy;
  lastFetchedAt: number;
};

export class Flagify implements IFlagifyClient {
  private flagCache: Map<string, CachedFlag> = new Map();
  private httpClient: FlagifyHttpClient;
  private realtime: RealtimeListener | null = null;
  private readyPromise: Promise<void>;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Called when a flag changes via SSE. Useful for triggering React re-renders. */
  onFlagChange: ((event: FlagChangeEvent) => void) | null = null;

  constructor(private readonly config: FlagifyOptions) {
    this.validateConfig();
    this.httpClient = createHttpClient(config);
    this.readyPromise = this.syncFlags();

    if (this.config.options?.realtime) {
      this.setupRealtimeListener();
    }

    if (this.config.options?.pollIntervalMs) {
      this.setupPolling();
    }
  }

  /** Resolves when the initial flag sync is complete. */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  getValue<T>(flagKey: string, fallback: T): T {
    const cached = this.flagCache.get(flagKey);

    if (!cached) return fallback;

    if (this.isStale(cached)) {
      this.refetchFlag(flagKey);
    }

    if (!cached.flag.enabled) return cached.flag.offValue as T;
    return (cached.flag.value as T) ?? fallback;
  }

  isEnabled(flagKey: string): boolean {
    const cached = this.flagCache.get(flagKey);

    if (!cached) return false;

    if (this.isStale(cached)) {
      this.refetchFlag(flagKey);
    }

    if (cached.flag.type !== "boolean") return false;
    if (!cached.flag.enabled) return cached.flag.offValue === true;
    return cached.flag.value === true;
  }

  getVariant(flagKey: string, fallback: string): string {
    const cached = this.flagCache.get(flagKey);

    if (!cached || !cached.flag.enabled) return fallback;

    const variants = cached.flag.variants;
    if (!variants || variants.length === 0) return fallback;

    // Return the variant key with the highest weight
    let best = variants[0];
    for (let i = 1; i < variants.length; i++) {
      if (variants[i].weight > best.weight) {
        best = variants[i];
      }
    }
    return best.key;
  }

  async evaluate(flagKey: string, user: FlagifyUser): Promise<EvaluateResult> {
    return this.httpClient.post<EvaluateResult>(
      `/v1/eval/flags/${flagKey}/evaluate`,
      { userId: user.id, attributes: user },
    );
  }

  /**
   * Disconnects the realtime listener and cleans up resources.
   */
  destroy(): void {
    if (this.realtime) {
      this.realtime.disconnect();
      this.realtime = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
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
      this.onFlagChange?.({
        environmentId: "",
        flagKey,
        action: "updated",
      });
    } catch (err) {
      console.warn(`[Flagify] Failed to refetch flag "${flagKey}":`, err);
    }
  }

  private async syncFlags(): Promise<void> {
    try {
      const flags = await this.httpClient.get<FlagifyFlaggy[]>(`/v1/eval/flags`);

      for (const flag of flags) {
        this.flagCache.set(flag.key, {
          flag,
          lastFetchedAt: Date.now(),
        });
      }

      const user = this.config.options?.user;
      if (user) {
        await this.evaluateWithUser(user);
      }
    } catch (err) {
      console.warn(`[Flagify] Failed to sync flags: ${err}`);
    }
  }

  private async evaluateWithUser(user: FlagifyUser): Promise<void> {
    try {
      const results = await this.httpClient.post<
        Array<{ key: string; value: FlagifyFlaggy["value"]; reason: string }>,
        { userId: string; attributes: FlagifyUser }
      >(`/v1/eval/flags/evaluate`, { userId: user.id, attributes: user });

      for (const result of results) {
        const cached = this.flagCache.get(result.key);
        if (cached) {
          this.flagCache.set(result.key, {
            flag: { ...cached.flag, value: result.value },
            lastFetchedAt: cached.lastFetchedAt,
          });
        }
      }
    } catch (err) {
      console.warn(`[Flagify] Failed to evaluate flags for user: ${err}`);
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

  private setupPolling(): void {
    const interval = this.config.options!.pollIntervalMs!;
    this.pollTimer = setInterval(async () => {
      await this.syncFlags();
      this.onFlagChange?.({ environmentId: "", flagKey: "*", action: "updated" });
    }, interval);
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

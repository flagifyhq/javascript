import { createHttpClient, FlagifyHttpClient } from "./api/httpClient";
import { RealtimeListener, FlagChangeEvent } from "./realtime";
import { IFlagifyClient } from "./types/FlagifyClient";
import { FlagifyFlag } from "./types/FlagifyFlag";
import { FlagifyOptions } from "./types/FlagifyTypes";
import { FlagifyUser } from "./types/FlagifyUser";

export interface EvaluateResult {
  key: string;
  value: unknown;
  reason: "targeting_rule" | "rollout" | "default" | "disabled";
}

type CachedFlag = {
  flag: FlagifyFlag;
  lastFetchedAt: number;
};

export class Flagify implements IFlagifyClient {
  private flagCache: Map<string, CachedFlag> = new Map();
  private httpClient: FlagifyHttpClient;
  private realtime: RealtimeListener | null = null;
  private readyPromise: Promise<void>;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inflightRefetches: Map<string, Promise<void>> = new Map();

  private flagChangeListeners: Set<(event: FlagChangeEvent) => void> = new Set();

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

  /** Subscribe to flag change events. Returns an unsubscribe function. */
  onFlagChange(listener: (event: FlagChangeEvent) => void): () => void {
    this.flagChangeListeners.add(listener);
    return () => this.flagChangeListeners.delete(listener);
  }

  private emitFlagChange(event: FlagChangeEvent): void {
    for (const listener of this.flagChangeListeners) {
      listener(event);
    }
  }

  getValue<T>(flagKey: string, fallback: T): T {
    const cached = this.flagCache.get(flagKey);

    if (!cached) return fallback;

    if (this.isStale(cached)) {
      this.refetchFlagDeduped(flagKey);
    }

    if (!cached.flag.enabled) return cached.flag.offValue as T;
    return (cached.flag.value as T) ?? fallback;
  }

  isEnabled(flagKey: string): boolean {
    const cached = this.flagCache.get(flagKey);

    if (!cached) return false;

    if (this.isStale(cached)) {
      this.refetchFlagDeduped(flagKey);
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

    const userId = this.config.options?.user?.id;
    if (!userId) {
      // No user context — deterministic pick by highest weight
      let best = variants[0];
      for (let i = 1; i < variants.length; i++) {
        if (variants[i].weight > best.weight) best = variants[i];
      }
      return best.key;
    }

    // Deterministic distribution: hash(userId + flagKey) → bucket → variant
    const hashValue = this.hashString(`${userId}:${flagKey}`);
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight === 0) return fallback;

    const bucket = hashValue % totalWeight;
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) return variant.key;
    }

    return fallback;
  }

  /**
   * FNV-1a 32-bit hash — fast, good distribution, deterministic.
   * Used for consistent variant assignment across sessions.
   */
  private hashString(input: string): number {
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < input.length; i++) {
      hash ^= input.charCodeAt(i);
      hash = (hash * 0x01000193) >>> 0; // FNV prime, keep as uint32
    }
    return hash;
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

    this.inflightRefetches.clear();
    this.flagChangeListeners.clear();
  }

  private refetchFlagDeduped(flagKey: string): void {
    if (this.inflightRefetches.has(flagKey)) return;
    const p = this.refetchFlag(flagKey).finally(() => {
      this.inflightRefetches.delete(flagKey);
    });
    this.inflightRefetches.set(flagKey, p);
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
      const fresh = await this.httpClient.get<FlagifyFlag>(
        `/v1/eval/flags/${flagKey}`,
      );
      this.flagCache.set(flagKey, {
        flag: fresh,
        lastFetchedAt: Date.now(),
      });

      // Re-evaluate with user context if configured (targeting rules need it)
      const user = this.config.options?.user;
      if (user) {
        const result = await this.httpClient.post<{
          key: string;
          value: FlagifyFlag["value"];
          reason: string;
        }>(`/v1/eval/flags/${flagKey}/evaluate`, {
          userId: user.id,
          attributes: user,
        });
        const cached = this.flagCache.get(flagKey);
        if (cached) {
          this.flagCache.set(flagKey, {
            flag: { ...cached.flag, value: result.value },
            lastFetchedAt: cached.lastFetchedAt,
          });
        }
      }

      this.emitFlagChange({
        environmentId: "",
        flagKey,
        action: "updated",
      });
    } catch (err) {
      console.warn(`[Flagify] Failed to refetch flag "${flagKey}":`, err);
    }
  }

  private async syncFlags(retries = 1): Promise<void> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const flags = await this.httpClient.get<FlagifyFlag[]>(`/v1/eval/flags`);

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
        return;
      } catch (err) {
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          console.warn(`[Flagify] Failed to sync flags after ${retries + 1} attempts: ${err}`);
        }
      }
    }
  }

  private async evaluateWithUser(user: FlagifyUser): Promise<void> {
    try {
      const results = await this.httpClient.post<
        Array<{ key: string; value: FlagifyFlag["value"]; reason: string }>,
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
      throw new Error(
        `[Flagify] Missing required config keys: ${missing.join(", ")}. ` +
          `Cannot initialize the Flagify client.`,
      );
    }
  }

  private setupPolling(): void {
    const interval = this.config.options!.pollIntervalMs!;
    this.pollTimer = setInterval(async () => {
      await this.syncFlags();
      this.emitFlagChange({ environmentId: "", flagKey: "*", action: "updated" });
    }, interval);
  }

  private setupRealtimeListener() {
    this.realtime = new RealtimeListener(this.httpClient, {
      onConnected: () => {
        console.info("[Flagify] Realtime connected");
      },
      onReconnected: () => {
        console.info("[Flagify] Realtime reconnected");
      },
      onInitialSync: (flags) => {
        for (const raw of flags) {
          const flag = raw as FlagifyFlag;
          this.flagCache.set(flag.key, {
            flag,
            lastFetchedAt: Date.now(),
          });
        }
        console.info(`[Flagify] Synced ${flags.length} flags via SSE`);

        const user = this.config.options?.user;
        if (user) {
          this.evaluateWithUser(user).catch((err) => {
            console.warn("[Flagify] Failed to evaluate flags after initial sync:", err);
          });
        }
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

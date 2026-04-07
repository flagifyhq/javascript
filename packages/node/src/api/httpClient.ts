import { FlagifyOptions } from "../types/FlagifyTypes";

export interface FlagifyHttpClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown, B = unknown>(path: string, body: B): Promise<T>;
  readonly baseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export function createHttpClient(config: FlagifyOptions): FlagifyHttpClient {
  const baseUrl =
    config.options?.apiUrl ??
    (typeof process !== "undefined" ? process.env.FLAGIFY_API_URL : undefined) ??
    "https://api.flagify.dev";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.publicKey,
    "x-project-key": config.projectKey,
  };

  if (config.secretKey) {
    headers["x-secret-key"] = config.secretKey;
  }

  const frozenHeaders: Readonly<Record<string, string>> = Object.freeze({ ...headers });

  return {
    baseUrl,
    headers: frozenHeaders,

    get: async <T = unknown>(path: string): Promise<T> => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`[HTTP GET] ${res.status} ${res.statusText}`);
      }

      return res.json();
    },

    post: async <T = unknown, B = unknown>(
      path: string,
      body: B,
    ): Promise<T> => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!res.ok) {
        throw new Error(`[HTTP POST] ${res.status} ${res.statusText}`);
      }

      return res.json();
    },
  };
}

import { FlagifyOptions } from "../types/FlagifyTypes";

export interface FlagifyHttpClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown, B = unknown>(path: string, body: B): Promise<T>;
  baseUrl: string;
  headers: Record<string, string>;
}

export function createHttpClient(config: FlagifyOptions): FlagifyHttpClient {
  const baseUrl =
    config.options?.apiUrl ??
    process.env.FLAGIFY_API_URL ??
    "https://api.flagify.dev";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": config.publicKey,
  };

  return {
    baseUrl,
    headers,

    get: async <T = unknown>(path: string): Promise<T> => {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers,
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
      });

      if (!res.ok) {
        throw new Error(`[HTTP POST] ${res.status} ${res.statusText}`);
      }

      return res.json();
    },
  };
}

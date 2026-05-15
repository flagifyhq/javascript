import { FlagifyOptions } from "../types/FlagifyTypes";

export class FlagifyAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FlagifyAuthError";
  }
}

export interface FlagifyHttpClient {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown, B = unknown>(path: string, body: B): Promise<T>;
  readonly baseUrl: string;
  readonly headers: Readonly<Record<string, string>>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

interface TimeoutSignal {
  signal: AbortSignal;
  cancel: () => void;
}

function createTimeoutSignal(ms: number): TimeoutSignal {
  const hasNativeTimeout =
    typeof AbortSignal !== "undefined" &&
    typeof (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout === "function";

  if (hasNativeTimeout) {
    return {
      signal: (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(ms),
      cancel: () => {},
    };
  }

  const controller = new AbortController();
  const reason =
    typeof DOMException !== "undefined"
      ? new DOMException("The operation timed out.", "TimeoutError")
      : Object.assign(new Error("The operation timed out."), { name: "TimeoutError" });
  const timer = setTimeout(() => {
    controller.abort(reason);
  }, ms);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

function throwForStatus(method: string, path: string, status: number, statusText: string): never {
  if (status === 401) {
    throw new FlagifyAuthError(
      `[Flagify] Unauthorized (401) on ${method} ${path}: Invalid or revoked API key. Check your publicKey.`,
      401,
    );
  }
  if (status === 403) {
    throw new FlagifyAuthError(
      `[Flagify] Forbidden (403) on ${method} ${path}: API key does not have access to this resource.`,
      403,
    );
  }
  if (status === 404) {
    throw new Error(
      `[Flagify] Not Found (404) on ${method} ${path}: Check your apiUrl and projectKey configuration.`,
    );
  }
  if (status >= 500) {
    throw new Error(`[Flagify] Server error (${status}) on ${method} ${path}: ${statusText}`);
  }
  throw new Error(`[Flagify] Request failed (${status}) on ${method} ${path}: ${statusText}`);
}

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
      const { signal, cancel } = createTimeoutSignal(DEFAULT_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}${path}`, {
          method: "GET",
          headers,
          signal,
        });
      } finally {
        cancel();
      }

      if (!res.ok) {
        throwForStatus("GET", path, res.status, res.statusText);
      }

      try {
        return await res.json();
      } catch {
        throw new Error(`[Flagify] Invalid JSON response on GET ${path}`);
      }
    },

    post: async <T = unknown, B = unknown>(
      path: string,
      body: B,
    ): Promise<T> => {
      const { signal, cancel } = createTimeoutSignal(DEFAULT_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal,
        });
      } finally {
        cancel();
      }

      if (!res.ok) {
        throwForStatus("POST", path, res.status, res.statusText);
      }

      try {
        return await res.json();
      } catch {
        throw new Error(`[Flagify] Invalid JSON response on POST ${path}`);
      }
    },
  };
}

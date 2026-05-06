import { createHmac, timingSafeEqual } from "crypto";

import { WebhookSignatureError } from "./errors";

export interface VerifyWebhookSignatureOptions {
  /**
   * Replay-attack window in seconds. Default `300` (5 minutes), matching
   * the upstream API. Set to `0` to disable timestamp checking entirely
   * (not recommended outside of replay-of-fixture tests).
   */
  tolerance?: number;
  /**
   * Override the "current time" used to evaluate the replay window.
   * Used by the test suite; rarely useful in production.
   */
  now?: () => Date;
}

const DEFAULT_TOLERANCE_SECONDS = 300;

const HEADER_NAME = "X-Flagify-Signature";

function toBuffer(input: string | Buffer | Uint8Array): Buffer {
  if (typeof input === "string") return Buffer.from(input, "utf8");
  if (Buffer.isBuffer(input)) return input;
  return Buffer.from(input);
}

function parseSignatureHeader(header: string): { ts: number; v1: string } {
  if (!header) {
    throw new WebhookSignatureError(
      "MISSING_HEADER",
      `${HEADER_NAME} header is empty or missing`,
    );
  }

  let ts = 0;
  let v1 = "";
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") ts = Number.parseInt(value, 10);
    if (key === "v1") v1 = value;
  }

  if (!Number.isFinite(ts) || ts <= 0 || !v1) {
    throw new WebhookSignatureError(
      "MALFORMED_HEADER",
      `${HEADER_NAME} malformed (expected "t=<unix>,v1=<hex>"): "${header}"`,
    );
  }

  return { ts, v1 };
}

/**
 * Verifies an `X-Flagify-Signature` header against a webhook payload.
 *
 * Returns `void` on success; throws {@link WebhookSignatureError} (with a
 * machine-readable `code`) on any failure mode:
 *
 * - `MISSING_HEADER` — no signature header was provided.
 * - `MALFORMED_HEADER` — header could not be parsed.
 * - `TIMESTAMP_OUT_OF_TOLERANCE` — `t=<unix>` is outside the replay window.
 * - `SIGNATURE_MISMATCH` — body or secret do not match.
 *
 * The `rawBody` MUST be the exact bytes the API delivered. Frameworks
 * that auto-parse JSON (Express's `express.json()`, NestJS, Astro, …)
 * mutate the body before it reaches your handler — read the raw stream
 * (e.g. `express.raw({ type: 'application/json' })`) before verifying.
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer | Uint8Array,
  signatureHeader: string,
  secret: string,
  options: VerifyWebhookSignatureOptions = {},
): void {
  if (!secret) {
    throw new WebhookSignatureError(
      "SIGNATURE_MISMATCH",
      "Webhook secret is empty",
    );
  }

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE_SECONDS;
  const nowMs = (options.now ? options.now() : new Date()).getTime();

  if (tolerance > 0) {
    const deltaSeconds = Math.abs(Math.floor(nowMs / 1000) - ts);
    if (deltaSeconds > tolerance) {
      throw new WebhookSignatureError(
        "TIMESTAMP_OUT_OF_TOLERANCE",
        `Signature timestamp ${ts} is more than ${tolerance}s away from now (${deltaSeconds}s drift)`,
      );
    }
  }

  const body = toBuffer(rawBody);
  const mac = createHmac("sha256", secret);
  mac.update(String(ts));
  mac.update(".");
  mac.update(body);
  const expected = mac.digest();

  let provided: Buffer;
  try {
    provided = Buffer.from(v1, "hex");
  } catch {
    throw new WebhookSignatureError(
      "MALFORMED_HEADER",
      "Signature hex is invalid",
    );
  }

  if (
    provided.length !== expected.length ||
    !timingSafeEqual(expected, provided)
  ) {
    throw new WebhookSignatureError(
      "SIGNATURE_MISMATCH",
      "Signature does not match expected value",
    );
  }
}

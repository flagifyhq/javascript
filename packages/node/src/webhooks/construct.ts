import { WebhookSignatureError } from "./errors";
import type {
  WebhookEvent,
  WebhookEventMetadata,
  WebhookEventType,
} from "./types";
import {
  verifyWebhookSignature,
  type VerifyWebhookSignatureOptions,
} from "./verify";

function bodyToString(input: string | Buffer | Uint8Array): string {
  if (typeof input === "string") return input;
  if (Buffer.isBuffer(input)) return input.toString("utf8");
  return Buffer.from(input).toString("utf8");
}

/**
 * Verifies the signature AND parses the JSON payload into a typed
 * {@link WebhookEvent}. This is the convenience entry point — most
 * receivers want both steps in one call.
 *
 * Throws {@link WebhookSignatureError} on any signature failure, plus a
 * `code: "INVALID_PAYLOAD"` variant if the body cannot be parsed as JSON.
 */
export function constructWebhookEvent<
  T extends WebhookEventType = WebhookEventType,
  M = WebhookEventMetadata,
>(
  rawBody: string | Buffer | Uint8Array,
  signatureHeader: string,
  secret: string,
  options: VerifyWebhookSignatureOptions = {},
): WebhookEvent<T, M> {
  verifyWebhookSignature(rawBody, signatureHeader, secret, options);

  const text = bodyToString(rawBody);
  try {
    return JSON.parse(text) as WebhookEvent<T, M>;
  } catch (err) {
    throw new WebhookSignatureError(
      "INVALID_PAYLOAD",
      `Failed to parse webhook body as JSON: ${(err as Error).message}`,
    );
  }
}

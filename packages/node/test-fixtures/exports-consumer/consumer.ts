// Type-level consumer fixture: compiled with `tsc --noEmit` under both
// `moduleResolution: bundler` and `moduleResolution: node16` to prove the
// `exports` map resolves types for the root and the webhooks subpath.
import { Flagify } from "@flagify/node";
import {
  verifyWebhookSignature,
  constructWebhookEvent,
  WebhookSignatureError,
  type VerifyWebhookSignatureOptions,
} from "@flagify/node/webhooks";

const options: VerifyWebhookSignatureOptions = { tolerance: 300 };

export function verify(rawBody: string, header: string, secret: string): void {
  try {
    verifyWebhookSignature(rawBody, header, secret, options);
    constructWebhookEvent(rawBody, header, secret);
  } catch (error) {
    if (error instanceof WebhookSignatureError) throw error;
    throw error;
  }
}

export type Client = Flagify;

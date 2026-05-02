/**
 * Re-exports the webhook signature helpers from `@flagify/node` so
 * NestJS consumers can `import { ... } from "@flagify/nestjs"` without a
 * second package import.
 */
export {
  WebhookSignatureError,
  constructWebhookEvent,
  verifyWebhookSignature,
  type VerifyWebhookSignatureOptions,
  type WebhookEvent,
  type WebhookEventActor,
  type WebhookEventData,
  type WebhookEventMetadata,
  type WebhookEventResource,
  type WebhookEventType,
  type WebhookSignatureErrorCode,
} from "@flagify/node";

export { FlagifyWebhookGuard } from "./webhook-signature.guard";
export type { WebhookSignatureGuardOptions } from "./webhook-signature.guard";

import {
  WebhookSignatureError,
  constructWebhookEvent,
  type VerifyWebhookSignatureOptions,
  type WebhookEvent,
  type WebhookEventType,
} from "@flagify/node/webhooks";

export {
  WebhookSignatureError,
  constructWebhookEvent,
  verifyWebhookSignature,
} from "@flagify/node/webhooks";
export type {
  VerifyWebhookSignatureOptions,
  WebhookEvent,
  WebhookEventActor,
  WebhookEventData,
  WebhookEventMetadata,
  WebhookEventResource,
  WebhookEventType,
  WebhookSignatureErrorCode,
} from "@flagify/node/webhooks";

export interface DefineWebhookHandlerOptions<
  T extends WebhookEventType = WebhookEventType,
> {
  /** Webhook secret. Read from `import.meta.env.FLAGIFY_WEBHOOK_SECRET` or similar. */
  secret: string;
  /**
   * Callback invoked for every successfully verified event. May be async.
   * The handler responds 200 once this returns; throw to respond 500.
   */
  onEvent: (event: WebhookEvent<T>) => void | Promise<void>;
  /**
   * Forwarded to {@link constructWebhookEvent}. Use to override the
   * replay-tolerance window (default 300s) or inject `now()` in tests.
   */
  verify?: VerifyWebhookSignatureOptions;
  /** Header name. Default `x-flagify-signature` (case-insensitive). */
  signatureHeader?: string;
}

const DEFAULT_HEADER = "x-flagify-signature";

/**
 * Astro-compatible webhook handler. Returns an `APIRoute`-shaped async
 * function suitable for `export const POST = defineWebhookHandler(...)`
 * inside `src/pages/api/<name>.ts`.
 *
 * Usage:
 *
 * ```ts
 * export const POST = defineWebhookHandler({
 *   secret: import.meta.env.FLAGIFY_WEBHOOK_SECRET,
 *   onEvent: async (event) => {
 *     // your business logic
 *   },
 * });
 * ```
 *
 * Astro must be running in SSR mode (or a hybrid route). Static pages
 * cannot serve webhooks.
 */
export function defineWebhookHandler<
  T extends WebhookEventType = WebhookEventType,
>(
  options: DefineWebhookHandlerOptions<T>,
): (ctx: { request: Request }) => Promise<Response> {
  const headerName = (options.signatureHeader ?? DEFAULT_HEADER).toLowerCase();

  return async function flagifyWebhookHandler({ request }) {
    const signatureHeader = request.headers.get(headerName) ?? "";

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return new Response("Failed to read request body", { status: 400 });
    }

    let event: WebhookEvent<T>;
    try {
      event = constructWebhookEvent<T>(
        rawBody,
        signatureHeader,
        options.secret,
        options.verify,
      );
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        return new Response(
          `Webhook signature verification failed: ${err.code}`,
          { status: 403 },
        );
      }
      throw err;
    }

    try {
      await options.onEvent(event);
    } catch (err) {
      return new Response(
        `Webhook handler error: ${(err as Error).message}`,
        { status: 500 },
      );
    }

    return new Response(null, { status: 200 });
  };
}

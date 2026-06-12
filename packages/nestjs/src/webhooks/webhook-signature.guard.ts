import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

import {
  WebhookSignatureError,
  constructWebhookEvent,
  type VerifyWebhookSignatureOptions,
  type WebhookEvent,
} from "@flagify/node/webhooks";

export interface WebhookSignatureGuardOptions {
  /**
   * Static webhook secret. Use when a single secret applies to every
   * request handled by this guard. For multi-webhook setups, prefer
   * {@link resolveSecret}.
   */
  secret?: string;
  /**
   * Resolves the secret per-request. Useful when each webhook has its
   * own secret and the guard needs to look it up by URL path, header,
   * or other request attribute.
   */
  resolveSecret?: (request: unknown) => string | Promise<string>;
  /** Forwarded to {@link constructWebhookEvent}. */
  verify?: VerifyWebhookSignatureOptions;
  /**
   * Where to read the signature header. Defaults to
   * `"x-flagify-signature"` (lowercase, matching `request.headers`).
   */
  signatureHeader?: string;
  /**
   * Where to read the raw request body. By default the guard reads
   * `request.rawBody` (the convention recommended by the Express
   * raw-body parser and required for verification — `body` is already
   * JSON-parsed and the bytes will not match the original signature).
   */
  rawBodyAccessor?: (request: any) => string | Buffer | Uint8Array | undefined;
}

const DEFAULT_HEADER = "x-flagify-signature";

const defaultRawBodyAccessor = (request: any) =>
  request?.rawBody ?? request?.body;

/**
 * NestJS guard that verifies the `X-Flagify-Signature` header on a
 * webhook request. On success it stores the parsed event on
 * `request.flagifyEvent` so handlers can read it without re-parsing.
 *
 * **Raw body required.** The guard signs over the exact bytes the API
 * delivered. Configure your NestJS app to expose the raw body, e.g.:
 *
 * ```ts
 * import { json } from "express";
 *
 * app.use(
 *   json({
 *     verify: (req: any, _res, buf) => { req.rawBody = buf; },
 *   }),
 * );
 * ```
 *
 * Or — if you only need to verify on a specific route — wrap the route
 * with `bodyParser.raw({ type: "application/json" })` and read the
 * Buffer from `request.body`.
 */
@Injectable()
export class FlagifyWebhookGuard implements CanActivate {
  constructor(private readonly options: WebhookSignatureGuardOptions) {
    if (!options.secret && !options.resolveSecret) {
      throw new Error(
        "FlagifyWebhookGuard: provide either `secret` or `resolveSecret`",
      );
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: any = context.switchToHttp().getRequest();

    const headerName = (
      this.options.signatureHeader ?? DEFAULT_HEADER
    ).toLowerCase();
    const signatureHeader: string =
      typeof request?.headers?.[headerName] === "string"
        ? request.headers[headerName]
        : "";

    const rawBody =
      (this.options.rawBodyAccessor ?? defaultRawBodyAccessor)(request);

    if (rawBody === undefined || rawBody === null) {
      throw new ForbiddenException(
        "FlagifyWebhookGuard: raw request body unavailable — configure express.json({ verify }) to populate request.rawBody",
      );
    }

    const secret = this.options.resolveSecret
      ? await this.options.resolveSecret(request)
      : this.options.secret!;

    try {
      const event: WebhookEvent = constructWebhookEvent(
        rawBody as string | Buffer | Uint8Array,
        signatureHeader,
        secret,
        this.options.verify,
      );
      request.flagifyEvent = event;
      return true;
    } catch (err) {
      if (err instanceof WebhookSignatureError) {
        throw new ForbiddenException(
          `Webhook signature verification failed: ${err.code}`,
        );
      }
      throw err;
    }
  }
}

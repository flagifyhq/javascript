/**
 * Canonical event type names. These mirror the API's
 * `internal/domain/webhook/model.go::SupportedEvents()`. Any drift is
 * a contract bug — keep this list in lockstep with the API.
 */
export type WebhookEventType =
  | "flag.created"
  | "flag.updated"
  | "flag.archived"
  | "flag.cloned"
  | "flag.toggled"
  | "flag.variants_set"
  | "flag.promoted"
  | "targeting.rules_set";

export interface WebhookEventActor {
  userId: string;
  email: string;
  name: string;
}

export interface WebhookEventResource {
  /** Resource kind, e.g. `"flag"`, `"flag_environment"`, `"targeting_rule_set"`. */
  type: string;
  /** ULID of the resource. */
  id: string;
}

/**
 * Default metadata shape — the API serializes the underlying audit event's
 * metadata map verbatim. Consumers can narrow this with the second type
 * parameter on `WebhookEvent` when they know the metadata schema for a
 * specific event type.
 */
export type WebhookEventMetadata = Record<string, unknown> | null;

export interface WebhookEventData<M = WebhookEventMetadata> {
  resource: WebhookEventResource;
  actor: WebhookEventActor;
  workspaceId: string;
  projectId: string;
  /**
   * Environment identifier. For project-wide events the API surfaces the
   * receiving webhook's own environment so this is always non-empty.
   */
  environmentId: string;
  metadata: M;
}

export interface WebhookEvent<
  T extends WebhookEventType = WebhookEventType,
  M = WebhookEventMetadata,
> {
  /**
   * Stable per-delivery ULID. Use as the idempotency key when persisting
   * webhook events on the receiver side — the API may retry deliveries
   * after transient failures.
   */
  id: string;
  event: T;
  /** RFC 3339 timestamp (UTC, nanosecond precision). */
  createdAt: string;
  data: WebhookEventData<M>;
}

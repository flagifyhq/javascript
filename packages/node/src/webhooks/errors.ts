export type WebhookSignatureErrorCode =
  | "MISSING_HEADER"
  | "MALFORMED_HEADER"
  | "TIMESTAMP_OUT_OF_TOLERANCE"
  | "SIGNATURE_MISMATCH"
  | "INVALID_PAYLOAD";

export class WebhookSignatureError extends Error {
  readonly code: WebhookSignatureErrorCode;

  constructor(code: WebhookSignatureErrorCode, message: string) {
    super(message);
    this.name = "WebhookSignatureError";
    this.code = code;
    Object.setPrototypeOf(this, WebhookSignatureError.prototype);
  }
}

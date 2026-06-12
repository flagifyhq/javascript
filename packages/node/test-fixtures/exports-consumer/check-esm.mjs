// Resolved via package self-reference: exercises the `import` condition of
// the `exports` map against the built dist/ artifacts.
import assert from "node:assert";

import * as webhooks from "@flagify/node/webhooks";
import * as root from "@flagify/node";

assert.strictEqual(typeof webhooks.verifyWebhookSignature, "function");
assert.strictEqual(typeof webhooks.constructWebhookEvent, "function");
assert.strictEqual(typeof webhooks.WebhookSignatureError, "function");

// Webhook helpers must NOT leak through the platform-neutral root entry.
assert.strictEqual(root.verifyWebhookSignature, undefined);
assert.strictEqual(root.constructWebhookEvent, undefined);
assert.strictEqual(root.WebhookSignatureError, undefined);

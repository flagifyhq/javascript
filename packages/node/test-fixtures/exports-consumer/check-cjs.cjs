// Resolved via package self-reference: exercises the `require` condition of
// the `exports` map against the built dist/ artifacts.
const assert = require("node:assert");

const webhooks = require("@flagify/node/webhooks");
const root = require("@flagify/node");

assert.strictEqual(typeof webhooks.verifyWebhookSignature, "function");
assert.strictEqual(typeof webhooks.constructWebhookEvent, "function");
assert.strictEqual(typeof webhooks.WebhookSignatureError, "function");

// Webhook helpers must NOT leak through the platform-neutral root entry.
assert.strictEqual(root.verifyWebhookSignature, undefined);
assert.strictEqual(root.constructWebhookEvent, undefined);
assert.strictEqual(root.WebhookSignatureError, undefined);

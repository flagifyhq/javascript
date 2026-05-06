import { createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";

import { defineWebhookHandler } from "../webhooks";

const SECRET = "topsecret";

function sign(body: string, ts: number, secret = SECRET): string {
  const mac = createHmac("sha256", secret);
  mac.update(String(ts));
  mac.update(".");
  mac.update(body);
  return `t=${ts},v1=${mac.digest("hex")}`;
}

function makeRequest(body: string, header: string): Request {
  return new Request("https://app.example.com/api/flagify-webhook", {
    method: "POST",
    body,
    headers: { "x-flagify-signature": header },
  });
}

describe("defineWebhookHandler", () => {
  it("returns 200 and invokes onEvent on a valid signature", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: "01HE",
      event: "flag.toggled",
      createdAt: new Date(ts * 1000).toISOString(),
      data: {
        resource: { type: "flag_environment", id: "01HF" },
        actor: { userId: "u", email: "u@x.io", name: "U" },
        workspaceId: "w",
        projectId: "p",
        environmentId: "e",
        metadata: null,
      },
    });
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const handler = defineWebhookHandler({ secret: SECRET, onEvent });

    const res = await handler({
      request: makeRequest(payload, sign(payload, ts)),
    });
    expect(res.status).toBe(200);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0]?.[0]?.event).toBe("flag.toggled");
  });

  it("returns 403 on a tampered body", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const onEvent = vi.fn();
    const handler = defineWebhookHandler({ secret: SECRET, onEvent });

    const res = await handler({
      request: makeRequest('{"x":1}', sign('{"x":2}', ts)),
    });
    expect(res.status).toBe(403);
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("returns 500 when onEvent throws", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      id: "1",
      event: "flag.created",
      createdAt: "now",
      data: {
        resource: { type: "flag", id: "f" },
        actor: { userId: "u", email: "u@x.io", name: "U" },
        workspaceId: "w",
        projectId: "p",
        environmentId: "e",
        metadata: null,
      },
    });
    const handler = defineWebhookHandler({
      secret: SECRET,
      onEvent: () => {
        throw new Error("downstream went boom");
      },
    });

    const res = await handler({ request: makeRequest(body, sign(body, ts)) });
    expect(res.status).toBe(500);
  });

  it("returns 403 when the signature header is missing", async () => {
    const handler = defineWebhookHandler({
      secret: SECRET,
      onEvent: () => undefined,
    });

    const req = new Request("https://x/api", {
      method: "POST",
      body: "{}",
    });
    const res = await handler({ request: req });
    expect(res.status).toBe(403);
  });
});

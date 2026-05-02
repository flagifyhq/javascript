import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { constructWebhookEvent } from "../webhooks/construct";
import { WebhookSignatureError } from "../webhooks/errors";
import { verifyWebhookSignature } from "../webhooks/verify";

const SECRET = "topsecret";

function sign(body: string | Buffer, ts: number, secret = SECRET): string {
  const mac = createHmac("sha256", secret);
  mac.update(String(ts));
  mac.update(".");
  mac.update(typeof body === "string" ? Buffer.from(body, "utf8") : body);
  return `t=${ts},v1=${mac.digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a valid signature within tolerance", () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = '{"hello":"world"}';
    expect(() =>
      verifyWebhookSignature(body, sign(body, ts), SECRET),
    ).not.toThrow();
  });

  it("accepts a Buffer body", () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = Buffer.from('{"hello":"world"}', "utf8");
    expect(() =>
      verifyWebhookSignature(body, sign(body, ts), SECRET),
    ).not.toThrow();
  });

  it("accepts the X-Flagify-Timestamp redundant header pattern", () => {
    // The API also sets `X-Flagify-Timestamp: <unix>` for receivers that
    // prefer reading the timestamp from a separate header. Our helper
    // only consumes `X-Flagify-Signature`, but extra "kv" pairs in that
    // header (e.g. future v2 hashes) must not break parsing.
    const ts = Math.floor(Date.now() / 1000);
    const body = "x";
    const baseHeader = sign(body, ts);
    const extended = `${baseHeader},v2=futureplaceholder`;
    expect(() =>
      verifyWebhookSignature(body, extended, SECRET),
    ).not.toThrow();
  });

  it("throws SIGNATURE_MISMATCH on tampered body", () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = sign('{"hello":"world"}', ts);
    expect(() =>
      verifyWebhookSignature('{"hello":"tampered"}', header, SECRET),
    ).toThrowError(
      expect.objectContaining({
        name: "WebhookSignatureError",
        code: "SIGNATURE_MISMATCH",
      }),
    );
  });

  it("throws SIGNATURE_MISMATCH on wrong secret", () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = "x";
    const header = sign(body, ts, "realsecret");
    expect(() =>
      verifyWebhookSignature(body, header, "wrongsecret"),
    ).toThrowError(
      expect.objectContaining({ code: "SIGNATURE_MISMATCH" }),
    );
  });

  it("throws SIGNATURE_MISMATCH when secret is empty", () => {
    const ts = Math.floor(Date.now() / 1000);
    expect(() =>
      verifyWebhookSignature("x", sign("x", ts), ""),
    ).toThrowError(
      expect.objectContaining({ code: "SIGNATURE_MISMATCH" }),
    );
  });

  it("throws TIMESTAMP_OUT_OF_TOLERANCE for old timestamps", () => {
    const ts = Math.floor(Date.now() / 1000) - 600;
    const body = "x";
    expect(() =>
      verifyWebhookSignature(body, sign(body, ts), SECRET, { tolerance: 300 }),
    ).toThrowError(
      expect.objectContaining({ code: "TIMESTAMP_OUT_OF_TOLERANCE" }),
    );
  });

  it("throws TIMESTAMP_OUT_OF_TOLERANCE for future timestamps", () => {
    const ts = Math.floor(Date.now() / 1000) + 600;
    const body = "x";
    expect(() =>
      verifyWebhookSignature(body, sign(body, ts), SECRET, { tolerance: 300 }),
    ).toThrowError(
      expect.objectContaining({ code: "TIMESTAMP_OUT_OF_TOLERANCE" }),
    );
  });

  it("respects a custom now() for deterministic tests", () => {
    const ts = 1_700_000_000;
    const body = "x";
    expect(() =>
      verifyWebhookSignature(body, sign(body, ts), SECRET, {
        tolerance: 30,
        now: () => new Date(ts * 1000),
      }),
    ).not.toThrow();
  });

  it("disables replay protection when tolerance is 0", () => {
    const ts = Math.floor(Date.now() / 1000) - 86_400;
    const body = "x";
    expect(() =>
      verifyWebhookSignature(body, sign(body, ts), SECRET, { tolerance: 0 }),
    ).not.toThrow();
  });

  it("throws MALFORMED_HEADER on bad header format", () => {
    expect(() =>
      verifyWebhookSignature("x", "invalidheader", SECRET),
    ).toThrowError(expect.objectContaining({ code: "MALFORMED_HEADER" }));
  });

  it("throws MALFORMED_HEADER when v1 hex is invalid", () => {
    const ts = Math.floor(Date.now() / 1000);
    const header = `t=${ts},v1=zzznothex`;
    expect(() =>
      verifyWebhookSignature("x", header, SECRET),
    ).toThrowError(expect.objectContaining({ code: "SIGNATURE_MISMATCH" }));
  });

  it("throws MISSING_HEADER on empty header", () => {
    expect(() => verifyWebhookSignature("x", "", SECRET)).toThrowError(
      expect.objectContaining({ code: "MISSING_HEADER" }),
    );
  });

  it("WebhookSignatureError is detectable via instanceof", () => {
    try {
      verifyWebhookSignature("x", "", SECRET);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookSignatureError);
    }
  });
});

describe("constructWebhookEvent", () => {
  it("verifies and parses the payload", () => {
    const ts = Math.floor(Date.now() / 1000);
    const payload = {
      id: "01HZX1WEBHOOKDELIVERY",
      event: "flag.toggled",
      createdAt: new Date(ts * 1000).toISOString(),
      data: {
        resource: { type: "flag_environment", id: "01HFLAGENV0000000000" },
        actor: {
          userId: "01HACTOR000000000000",
          email: "actor@example.com",
          name: "Actor One",
        },
        workspaceId: "01HWORKSPACE0000000",
        projectId: "01HPROJECT0000000000",
        environmentId: "01HENVIRONMENT00000",
        metadata: { from: false, to: true },
      },
    };
    const body = JSON.stringify(payload);
    const evt = constructWebhookEvent<"flag.toggled">(
      body,
      sign(body, ts),
      SECRET,
    );
    expect(evt.event).toBe("flag.toggled");
    expect(evt.data.environmentId).toBe("01HENVIRONMENT00000");
    expect(evt.data.metadata).toEqual({ from: false, to: true });
  });

  it("throws INVALID_PAYLOAD on non-JSON body", () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = "not-json";
    expect(() =>
      constructWebhookEvent(body, sign(body, ts), SECRET),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PAYLOAD" }));
  });

  it("throws on bad signature before attempting JSON parse", () => {
    expect(() =>
      constructWebhookEvent("not-json", "malformed", SECRET),
    ).toThrowError(expect.objectContaining({ code: "MALFORMED_HEADER" }));
  });
});

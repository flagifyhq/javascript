import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";

import { FlagifyWebhookGuard } from "../webhooks/webhook-signature.guard";

const SECRET = "topsecret";

function sign(body: string, ts: number, secret = SECRET): string {
  const mac = createHmac("sha256", secret);
  mac.update(String(ts));
  mac.update(".");
  mac.update(body);
  return `t=${ts},v1=${mac.digest("hex")}`;
}

function makeContext(request: {
  headers: Record<string, string>;
  rawBody?: string | Buffer;
  body?: unknown;
}): { ctx: ExecutionContext; request: typeof request } {
  const ctx = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

describe("FlagifyWebhookGuard", () => {
  it("rejects construction with no secret strategy", () => {
    expect(() => new FlagifyWebhookGuard({})).toThrowError(
      /provide either `secret` or `resolveSecret`/,
    );
  });

  it("returns true and attaches flagifyEvent on a valid signature", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: "01HE",
      event: "flag.toggled",
      createdAt: new Date(ts * 1000).toISOString(),
      data: {
        resource: { type: "flag_environment", id: "01HFLAG" },
        actor: { userId: "u", email: "u@x.io", name: "U" },
        workspaceId: "w",
        projectId: "p",
        environmentId: "e",
        metadata: { from: false, to: true },
      },
    });
    const guard = new FlagifyWebhookGuard({ secret: SECRET });
    const { ctx, request } = makeContext({
      headers: { "x-flagify-signature": sign(payload, ts) },
      rawBody: Buffer.from(payload),
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect((request as any).flagifyEvent.event).toBe("flag.toggled");
    expect((request as any).flagifyEvent.data.environmentId).toBe("e");
  });

  it("throws ForbiddenException on tampered body", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const guard = new FlagifyWebhookGuard({ secret: SECRET });
    const { ctx } = makeContext({
      headers: { "x-flagify-signature": sign("{}", ts) },
      rawBody: Buffer.from('{"tampered":true}'),
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("throws ForbiddenException when raw body is missing", async () => {
    const guard = new FlagifyWebhookGuard({ secret: SECRET });
    const { ctx } = makeContext({
      headers: { "x-flagify-signature": "t=1,v1=abc" },
    });

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("supports per-request secret resolution", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = "{}";
    const guard = new FlagifyWebhookGuard({
      resolveSecret: async () => SECRET,
    });
    const { ctx } = makeContext({
      headers: { "x-flagify-signature": sign(body, ts) },
      rawBody: body,
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("respects a custom rawBodyAccessor", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const body = "{}";
    const guard = new FlagifyWebhookGuard({
      secret: SECRET,
      rawBodyAccessor: (req: any) => req.original,
    });
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { "x-flagify-signature": sign(body, ts) },
          original: body,
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { FlagifyAuthProvider } from "../FlagifyAuthProvider";
import type { FlagifyUser } from "@flagify/node";

const constructorSpy = vi.fn();
const destroySpy = vi.fn();

vi.mock("@flagify/node", async () => {
  class FakeFlagify {
    constructor(config: unknown) {
      constructorSpy(config);
    }
    ready() {
      return Promise.resolve();
    }
    destroy() {
      destroySpy();
    }
    onFlagChange() {
      return () => {};
    }
    isEnabled() {
      return false;
    }
    getValue<T>(_: string, fallback: T): T {
      return fallback;
    }
    getVariant(_: string, fallback: string) {
      return fallback;
    }
  }
  return { Flagify: FakeFlagify };
});

beforeEach(() => {
  cleanup();
  constructorSpy.mockClear();
  destroySpy.mockClear();
});

function renderWith(
  useUserHook: () => FlagifyUser | null | undefined,
  extraProps: {
    userKey?: (user: FlagifyUser | null | undefined) => string;
    options?: Record<string, unknown>;
  } = {},
) {
  return render(
    <FlagifyAuthProvider
      projectKey="proj"
      publicKey="pk_test_123"
      useUserHook={useUserHook}
      {...extraProps}
    >
      <span>ok</span>
    </FlagifyAuthProvider>,
  );
}

describe("FlagifyAuthProvider", () => {
  it("renders children", () => {
    renderWith(() => ({ id: "u1", role: "admin" }));
    expect(screen.getByText("ok")).toBeInTheDocument();
  });

  it("forwards the user returned by useUserHook to the Flagify client", async () => {
    await act(async () => {
      renderWith(() => ({ id: "u1", role: "admin" }));
    });
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    const config = constructorSpy.mock.calls[0][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(config.options?.user).toEqual({ id: "u1", role: "admin" });
  });

  it("passes undefined user and keys by 'anonymous' when the hook returns null", async () => {
    await act(async () => {
      renderWith(() => null);
    });
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    const config = constructorSpy.mock.calls[0][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(config.options?.user).toBeUndefined();
  });

  it("remounts the provider when user.id changes (logout → different user)", async () => {
    let currentUser: FlagifyUser = { id: "u1", role: "viewer" };
    const useUserHook = () => currentUser;

    const { rerender } = renderWith(useUserHook);
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    currentUser = { id: "u2", role: "admin" };
    await act(async () => {
      rerender(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={useUserHook}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });

    expect(constructorSpy).toHaveBeenCalledTimes(2);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    const secondConfig = constructorSpy.mock.calls[1][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(secondConfig.options?.user?.id).toBe("u2");
  });

  it("remounts on impersonation / role-only change (same id, different role)", async () => {
    let currentUser: FlagifyUser = { id: "u1", role: "viewer" };
    const useUserHook = () => currentUser;

    const { rerender } = renderWith(useUserHook);
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    // Same id, different role — the default userKey hashes the full user
    // object, so this MUST force a remount so targeting rules keyed on
    // role re-evaluate for the new identity.
    currentUser = { id: "u1", role: "admin" };
    await act(async () => {
      rerender(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={useUserHook}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });

    expect(constructorSpy).toHaveBeenCalledTimes(2);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    const secondConfig = constructorSpy.mock.calls[1][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(secondConfig.options?.user?.role).toBe("admin");
  });

  it("remounts on login (null → user)", async () => {
    let currentUser: FlagifyUser | null = null;
    const useUserHook = () => currentUser;

    const { rerender } = renderWith(useUserHook);
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    currentUser = { id: "u1", role: "viewer" };
    await act(async () => {
      rerender(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={useUserHook}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });

    expect(constructorSpy).toHaveBeenCalledTimes(2);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    const secondConfig = constructorSpy.mock.calls[1][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(secondConfig.options?.user?.id).toBe("u1");
  });

  it("remounts on logout (user → null)", async () => {
    let currentUser: FlagifyUser | null = { id: "u1", role: "viewer" };
    const useUserHook = () => currentUser;

    const { rerender } = renderWith(useUserHook);
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    currentUser = null;
    await act(async () => {
      rerender(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={useUserHook}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });

    expect(constructorSpy).toHaveBeenCalledTimes(2);
    expect(destroySpy).toHaveBeenCalledTimes(1);
    const secondConfig = constructorSpy.mock.calls[1][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(secondConfig.options?.user).toBeUndefined();
  });

  it("calls destroy when unmounted", async () => {
    const { unmount } = renderWith(() => ({ id: "u1" }));
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(destroySpy).toHaveBeenCalledTimes(0);

    unmount();
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it("honors a custom userKey override that narrows to id only", async () => {
    let currentUser: FlagifyUser = { id: "u1", role: "viewer" };
    const useUserHook = () => currentUser;
    const userKey = (u: FlagifyUser | null | undefined) => u?.id ?? "anonymous";

    const { rerender } = renderWith(useUserHook, { userKey });
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    // Role changes but id does not; custom key only fingerprints id,
    // so no remount — this is the opposite of the default behavior and
    // proves the override prop is wired through.
    currentUser = { id: "u1", role: "admin" };
    await act(async () => {
      rerender(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={useUserHook}
          userKey={userKey}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });

    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(destroySpy).toHaveBeenCalledTimes(0);
  });

  it("does NOT remount when user attributes are re-ordered (stable hash)", async () => {
    // Same logical user, different insertion order — a naive
    // JSON.stringify would produce different strings and force a
    // spurious remount. The default userKey sorts top-level keys so
    // this round-trips.
    let currentUser: FlagifyUser = { id: "u1", role: "admin", email: "a@b.com" };
    const useUserHook = () => currentUser;

    const { rerender } = renderWith(useUserHook);
    await act(async () => {});
    expect(constructorSpy).toHaveBeenCalledTimes(1);

    currentUser = { email: "a@b.com", id: "u1", role: "admin" };
    await act(async () => {
      rerender(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={useUserHook}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });

    expect(constructorSpy).toHaveBeenCalledTimes(1);
    expect(destroySpy).toHaveBeenCalledTimes(0);
  });

  it("does not crash when the user contains a non-JSON value (BigInt)", async () => {
    // Custom attributes can be anything — including BigInt, which
    // throws in JSON.stringify. The default userKey catches that
    // and falls back to user.id so the provider tree still renders.
    const useUserHook = () =>
      ({ id: "u1", role: "admin", accountBalance: 10n } as unknown as FlagifyUser);

    expect(() => renderWith(useUserHook)).not.toThrow();
    expect(constructorSpy).toHaveBeenCalledTimes(1);
  });

  it("forwards options.realtime and options.apiUrl to the client", async () => {
    await act(async () => {
      renderWith(() => ({ id: "u1" }), {
        options: { realtime: true, apiUrl: "https://api.test.example" },
      });
    });
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    const config = constructorSpy.mock.calls[0][0] as {
      options?: { realtime?: boolean; apiUrl?: string };
    };
    expect(config.options?.realtime).toBe(true);
    expect(config.options?.apiUrl).toBe("https://api.test.example");
  });
});

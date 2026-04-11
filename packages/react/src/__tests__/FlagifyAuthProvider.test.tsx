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

describe("FlagifyAuthProvider", () => {
  it("renders children", () => {
    render(
      <FlagifyAuthProvider
        projectKey="proj"
        publicKey="pk_test_123"
        useUserHook={() => ({ id: "u1", role: "admin" })}
      >
        <span>child</span>
      </FlagifyAuthProvider>,
    );
    expect(screen.getByText("child")).toBeInTheDocument();
  });

  it("forwards the user returned by useUserHook to the Flagify client", async () => {
    await act(async () => {
      render(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={() => ({ id: "u1", role: "admin" })}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    const config = constructorSpy.mock.calls[0][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(config.options?.user).toEqual({ id: "u1", role: "admin" });
  });

  it("passes undefined user and keys by 'anonymous' when the hook returns null", async () => {
    await act(async () => {
      render(
        <FlagifyAuthProvider
          projectKey="proj"
          publicKey="pk_test_123"
          useUserHook={() => null}
        >
          <span>ok</span>
        </FlagifyAuthProvider>,
      );
    });
    expect(constructorSpy).toHaveBeenCalledTimes(1);
    const config = constructorSpy.mock.calls[0][0] as {
      options?: { user?: FlagifyUser };
    };
    expect(config.options?.user).toBeUndefined();
  });

  it("remounts the provider when user.id changes", async () => {
    let currentUser: FlagifyUser | null = { id: "u1", role: "viewer" };
    const useUserHook = () => currentUser;

    const { rerender } = render(
      <FlagifyAuthProvider
        projectKey="proj"
        publicKey="pk_test_123"
        useUserHook={useUserHook}
      >
        <span>ok</span>
      </FlagifyAuthProvider>,
    );

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
});

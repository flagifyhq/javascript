import type { ReactNode } from "react";
import type { FlagifyUser } from "@flagify/node";
import { FlagifyProvider, type FlagifyProviderProps } from "./FlagifyProvider";

type FlagifyProviderOptions = NonNullable<FlagifyProviderProps["options"]>;

export interface FlagifyAuthProviderProps
  extends Omit<FlagifyProviderProps, "children" | "options"> {
  useUserHook: () => FlagifyUser | null | undefined;
  /**
   * Override how the wrapper builds the remount key from the current
   * user. The default hashes the user object with sorted keys for
   * authenticated users and returns the literal string `"anonymous"`
   * for `null`/`undefined`. Override to narrow (e.g. id only) or widen
   * (e.g. include nested geolocation). Your override receives
   * `null`/`undefined` for anonymous — handle it explicitly.
   */
  userKey?: (user: FlagifyUser | null | undefined) => string;
  options?: Omit<FlagifyProviderOptions, "user">;
  children: ReactNode;
}

const defaultUserKey = (user: FlagifyUser | null | undefined): string => {
  if (!user) return "anonymous";
  // Stable hash: stringify with sorted top-level keys so two semantically
  // equal users constructed in different insertion orders (spread,
  // GraphQL selection-set variance, store slice recomposition) don't cause
  // spurious remounts. Falls back to `user.id` if stringify throws — e.g.
  // when a consumer attaches a BigInt custom attribute. Without the guard
  // a non-JSON value would crash the provider tree on every render.
  try {
    return JSON.stringify(user, Object.keys(user).sort());
  } catch {
    return user.id ?? "anonymous";
  }
};

export function FlagifyAuthProvider({
  useUserHook,
  userKey = defaultUserKey,
  options,
  children,
  projectKey,
  publicKey,
}: FlagifyAuthProviderProps) {
  const user = useUserHook();
  return (
    <FlagifyProvider
      key={userKey(user)}
      projectKey={projectKey}
      publicKey={publicKey}
      options={{ ...options, user: user ?? undefined }}
    >
      {children}
    </FlagifyProvider>
  );
}

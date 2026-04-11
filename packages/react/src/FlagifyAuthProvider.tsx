import type { ReactNode } from "react";
import type { FlagifyUser } from "@flagify/node";
import { FlagifyProvider, type FlagifyProviderProps } from "./FlagifyProvider";

type FlagifyProviderOptions = NonNullable<FlagifyProviderProps["options"]>;

export interface FlagifyAuthProviderProps
  extends Omit<FlagifyProviderProps, "children" | "options"> {
  useUserHook: () => FlagifyUser | null | undefined;
  /**
   * Override how the wrapper fingerprints the current user to decide
   * when to remount `<FlagifyProvider>`. The default stringifies the
   * full user object so any attribute change — impersonation, role
   * upgrade, plan change, custom attribute — forces a resync. Override
   * if you want narrower re-evaluation (e.g. only on id changes).
   */
  userKey?: (user: FlagifyUser | null | undefined) => string;
  options?: Omit<FlagifyProviderOptions, "user">;
  children: ReactNode;
}

const defaultUserKey = (user: FlagifyUser | null | undefined): string =>
  user ? JSON.stringify(user) : "anonymous";

export function FlagifyAuthProvider({
  useUserHook,
  userKey = defaultUserKey,
  options,
  children,
  projectKey,
  publicKey,
  secretKey,
}: FlagifyAuthProviderProps) {
  const user = useUserHook();
  return (
    <FlagifyProvider
      key={userKey(user)}
      projectKey={projectKey}
      publicKey={publicKey}
      secretKey={secretKey}
      options={{ ...options, user: user ?? undefined }}
    >
      {children}
    </FlagifyProvider>
  );
}

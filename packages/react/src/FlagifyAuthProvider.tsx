import type { ReactNode } from "react";
import type { FlagifyUser } from "@flagify/node";
import { FlagifyProvider, type FlagifyProviderProps } from "./FlagifyProvider";

type FlagifyProviderOptions = NonNullable<FlagifyProviderProps["options"]>;

export interface FlagifyAuthProviderProps
  extends Omit<FlagifyProviderProps, "children" | "options"> {
  useUserHook: () => FlagifyUser | null | undefined;
  options?: Omit<FlagifyProviderOptions, "user">;
  children: ReactNode;
}

export function FlagifyAuthProvider({
  useUserHook,
  options,
  children,
  ...rest
}: FlagifyAuthProviderProps) {
  const user = useUserHook();
  return (
    <FlagifyProvider
      key={user?.id ?? "anonymous"}
      {...rest}
      options={{ ...options, user: user ?? undefined }}
    >
      {children}
    </FlagifyProvider>
  );
}

import type { ComponentProps } from "react";
import type { FlagifyProvider } from "./FlagifyProvider";

export type FlagifyProviderChildren = ComponentProps<
  typeof FlagifyProvider
>["children"];

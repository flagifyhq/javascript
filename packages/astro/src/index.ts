export { default } from "./integration";
export { defineFlag } from "./flag";
export type { FlagEvaluator } from "./flag";
export type {
  FlagifyAstroOptions,
  FlagDefinition,
  FlagifyLocals,
} from "./types";
export { initClient, getClient, waitForClient, destroyClient } from "./client";

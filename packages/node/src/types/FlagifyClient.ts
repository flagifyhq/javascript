/**
 * Interface defining the core methods for the Flaggy client.
 */
export interface IFlagifyClient {
  /**
   * Retrieves the resolved value of a feature flag.
   * Falls back to defaultValue if evaluation fails or flag is not found.
   *
   * @param flagKey - The key of the feature flag to retrieve.
   * @returns The resolved value of the feature flag.
   */
  getValue<T>(flagKey: string, fallback: T): T;

  /**
   * Checks if a boolean feature flag is enabled.
   * Returns false if flag is not found or default is false.
   *
   * @param flagKey - The key of the feature flag to check.
   * @returns True if the flag is enabled, false otherwise.
   */
  isEnabled(flagKey: string): boolean;

  /**
   * Returns the variant key with the highest weight for a multivariate flag.
   * Returns fallback if the flag is missing, disabled, or has no variants.
   *
   * @param flagKey - The key of the feature flag.
   * @param fallback - The default variant key.
   * @returns The winning variant key.
   */
  getVariant(flagKey: string, fallback: string): string;

  /**
   * Evaluates a flag with user context for targeting rules.
   * Calls the API's evaluate endpoint directly (not cached).
   */
  evaluate(flagKey: string, user: import('./FlagifyUser').FlagifyUser): Promise<import('../client').EvaluateResult>;
}

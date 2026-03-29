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
  getValue<T = unknown>(flagKey: string): T;

  /**
   * Checks if a boolean feature flag is enabled.
   * Returns false if flag is not found or default is false.
   *
   * @param flagKey - The key of the feature flag to check.
   * @returns True if the flag is enabled, false otherwise.
   */
  isEnabled(flagKey: string): boolean;
}

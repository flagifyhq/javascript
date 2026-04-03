import { FlagifyUser } from "./FlagifyUser";

/**
 * Configuration options required to initialize the Flagify client.
 */
export interface FlagifyOptions {
  /**
   * The key identifying the project within your Flagify workspace.
   */
  projectKey: string;

  /**
   * Public API key used to identify the client or application.
   * This is safe to expose in client-side environments (e.g., browser, mobile).
   */
  publicKey: string;

  /**
   * Optional private key for secure server-side communication.
   * Never expose this in frontend environments.
   */
  secretKey?: string;

  /**
   * Additional optional configuration for advanced use cases.
   */
  options?: {
    /**
     * Contextual user data for targeting rules and segmentation.
     * You may provide built-in fields like `id`, `email`, `role`, or custom traits.
     */
    user?: FlagifyUser;

    /**
     * Custom base URL for the Flagify API (e.g., for self-hosted instances or testing).
     * Defaults to "https://api.flagify.app" if not provided.
     */
    apiUrl?: string;

    /**
     * Optional cache stale time in milliseconds for local flag resolution.
     * Defaults to 5 minutes.
     */
    staleTimeMs?: number;

    /**
     * Enables real-time flag updates via Server-Sent Events.
     */
    realtime?: boolean;

    /**
     * Interval in milliseconds to periodically re-sync all flags.
     * Useful as a fallback when realtime is unavailable.
     * Example: 30000 (every 30 seconds).
     */
    pollIntervalMs?: number;
  };
}

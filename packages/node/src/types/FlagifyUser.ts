/**
 * Represents a user context object used for feature flag targeting.
 *
 * You can define standard properties like `id`, `email`, `role`, and `group`,
 * as well as any number of custom attributes for segmentation purposes.
 */
export interface FlagifyUser {
  /**
   * Unique identifier for the user.
   * This is typically required for targeting, experimentation, or auditing.
   */
  id: string

  /**
   * Optional email address of the user.
   */
  email?: string

  /**
   * Optional role or access level of the user (e.g., "admin", "editor", "viewer").
   */
  role?: string

  /**
   * Optional group or organization to which the user belongs.
   */
  group?: string

  /**
   * Optional geolocation details used for region-based targeting.
   */
  geolocation?: {
    /**
     * ISO country code (e.g., "US", "MX", "DE").
     */
    country?: string

    /**
     * Optional region or state within the country.
     */
    region?: string

    /**
     * Optional city or locality.
     */
    city?: string
  }

  /**
   * Any other custom attributes for advanced targeting rules.
   */
  [key: string]: unknown
}

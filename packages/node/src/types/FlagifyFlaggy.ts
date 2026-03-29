/**
 * Represents a feature flag within the Flagify system.
 */
export interface FlagifyFlaggy {
  /**
   * Unique identifier for the flag (e.g., "new-dashboard").
   */
  key: string

  /**
   * Human-readable name of the flag.
   */
  name: string

  /**
   * The current value of the flag, which can be a boolean, string, number, or JSON object.
   * This is the value that will be returned when the flag is evaluated.
   */
  value: boolean | string | number | Record<string, unknown>

  /**
   * Detailed description of the flag's purpose.
   */
  description?: string

  /**
   * Data type of the flag's value (e.g., "boolean", "string", "number", "json").
   */
  type: 'boolean' | 'string' | 'number' | 'json'

  /**
   * Default value to use when no targeting rules match or in case of evaluation failure.
   */
  defaultValue: boolean | string | number | Record<string, unknown>

  /**
   * Indicates whether the flag is currently active.
   */
  enabled: boolean

  /**
   * Optional rollout percentage (0 to 100) for gradual feature releases.
   */
  rolloutPercentage?: number

  /**
   * Optional targeting rules for user segmentation.
   */
  targetingRules?: Array<{
    attribute: string
    operator:
      | 'equals'
      | 'not_equals'
      | 'contains'
      | 'not_contains'
      | 'starts_with'
      | 'ends_with'
    value: string | number | boolean
  }>

  /**
   * Timestamp of when the flag was created.
   */
  createdAt: string // ISO 8601 format

  /**
   * Timestamp of the last update to the flag.
   */
  updatedAt: string // ISO 8601 format
}

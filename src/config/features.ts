/**
 * Product capabilities that are switched on explicitly (build-time `VITE_FEATURE_*`, off unless set
 * to "true" or "1").
 *
 * A feature that is off must not touch its backend at all: no request, no table, no function.
 * Presentations is still a "Soon" feature and its table does not exist in production, so opening
 * a document must not query it; asking and tolerating the 404 is not an acceptable substitute.
 */
const FLAG_VARIABLES = {
  presentations: 'VITE_FEATURE_PRESENTATIONS',
} as const;

export type FeatureName = keyof typeof FLAG_VARIABLES;

export function isFeatureEnabled(feature: FeatureName): boolean {
  const value = (import.meta.env as Record<string, string | undefined>)[FLAG_VARIABLES[feature]];
  return value === 'true' || value === '1';
}

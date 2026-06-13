/**
 * Returns the Tailwind badge class for a confidence score.
 *
 * Thresholds (docs/AI_PROMPT_MANIFEST.md §0.1):
 *   > 0.75 → confident (green)
 *   0.50–0.75 → probable / low confidence (neutral)
 *   < 0.50 → uncertain (amber)
 */
export function getConfidenceBadgeClass(score: number): string {
  if (score > 0.75) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (score >= 0.5)
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
}

/**
 * Returns a translation key + params for the verbose confidence badge label.
 *
 * Used in the active match card where the text must follow the active locale.
 */
export function getConfidenceBadgeKeyAndParams(score: number): {
  key: string;
  params: { pct: number };
} {
  const pct = Math.round(score * 100);
  if (score > 0.75) return { key: 'botanical.identifier.confidenceHighPct', params: { pct } };
  if (score >= 0.5) return { key: 'botanical.identifier.confidenceLowPct', params: { pct } };
  return { key: 'botanical.identifier.confidenceUncertainPct', params: { pct } };
}

/**
 * Returns the compact percentage-only label for candidate chips, or the
 * human-readable verbose label (EN only) when verbose=true.
 */
export function getConfidenceBadgeLabel(score: number, verbose = true): string {
  const pct = Math.round(score * 100);
  if (!verbose) return `${pct}%`;
  if (score > 0.75) return `${pct}% confident`;
  if (score >= 0.5) return `${pct}% — low confidence`;
  return `${pct}% — uncertain`;
}

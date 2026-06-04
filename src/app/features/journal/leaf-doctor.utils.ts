export function confidenceBadgeClass(score: number): string {
  if (score < 0.5) return 'bg-danger-500/10 text-danger-700 dark:text-danger-500';
  if (score <= 0.75) return 'bg-warning-500/10 text-warning-500';
  return 'bg-success-500/10 text-success-500';
}

export function confidenceBadgeLabel(score: number): string {
  if (score < 0.5) return 'Uncertain';
  if (score <= 0.75) return 'Low confidence';
  return 'Confident';
}

export function riskBadgeClass(risk: string): string {
  if (risk === 'ZoneContagious') return 'bg-warning-500/10 text-warning-500';
  if (risk === 'FatalThreat') return 'bg-danger-500/10 text-danger-700 dark:text-danger-500';
  return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
}

export function riskBadgeLabel(risk: string): string {
  if (risk === 'ZoneContagious') return 'May spread to nearby plants';
  if (risk === 'FatalThreat') return 'Fatal if untreated';
  return 'Contained — not spreading';
}

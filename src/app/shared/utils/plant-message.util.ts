export function plantAddedDetail(commonName: string, nextCheckAt: string): string {
  const nextDate = new Date(nextCheckAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return `"${commonName}" added. First check on ${nextDate}.`;
}

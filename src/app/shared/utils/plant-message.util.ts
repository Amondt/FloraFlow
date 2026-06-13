export function plantAddedDetail(
  commonName: string,
  nextCheckAt: string,
): { key: string; params: { name: string; date: string } } {
  const date = new Date(nextCheckAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return { key: 'tasks.toast.plantAddedDetail', params: { name: commonName, date } };
}

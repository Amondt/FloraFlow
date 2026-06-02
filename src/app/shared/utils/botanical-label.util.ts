export const SUNLIGHT_LABEL: Record<string, string> = {
  full_sun: 'Full sun',
  part_shade: 'Part shade',
  full_shade: 'Shade',
  filtered_indirect: 'Indirect',
};

export const WATERING_LABEL: Record<string, string> = {
  Frequent: 'Every 1–2 days',
  Average: 'Every 3–7 days',
  Minimum: 'Every 7–14 days',
  None: 'Drought-tolerant',
};

export function getSunlightLabels(sunlight: string[] | null | undefined): string[] {
  return (sunlight ?? []).map((s) => SUNLIGHT_LABEL[s] ?? s);
}

export function getWateringLabel(watering: string | null | undefined): string | null {
  return watering ? (WATERING_LABEL[watering] ?? watering) : null;
}

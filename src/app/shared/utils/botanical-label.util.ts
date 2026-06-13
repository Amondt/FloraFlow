export const SUNLIGHT_KEY: Record<string, string> = {
  full_sun: 'botanical.care.sunlightLabels.fullSun',
  'full sun': 'botanical.care.sunlightLabels.fullSun',
  part_shade: 'botanical.care.sunlightLabels.partShade',
  'part shade': 'botanical.care.sunlightLabels.partShade',
  full_shade: 'botanical.care.sunlightLabels.fullShade',
  'full shade': 'botanical.care.sunlightLabels.fullShade',
  filtered_indirect: 'botanical.care.sunlightLabels.filteredIndirect',
  'filtered indirect': 'botanical.care.sunlightLabels.filteredIndirect',
};

export const WATERING_KEY: Record<string, string> = {
  Frequent: 'botanical.care.wateringLabels.frequent',
  Average: 'botanical.care.wateringLabels.average',
  Minimum: 'botanical.care.wateringLabels.minimum',
  None: 'botanical.care.wateringLabels.none',
};

export const CARE_DIFFICULTY_KEY: Record<string, string> = {
  Beginner: 'botanical.care.difficultyLabels.beginner',
  Intermediate: 'botanical.care.difficultyLabels.intermediate',
  Advanced: 'botanical.care.difficultyLabels.advanced',
};

export const MAINTENANCE_LEVEL_KEY: Record<string, string> = {
  Low: 'botanical.care.maintenanceLabels.low',
  Medium: 'botanical.care.maintenanceLabels.medium',
  High: 'botanical.care.maintenanceLabels.high',
};

export const PREFERRED_SOIL_KEY: Record<string, string> = {
  'Well-draining': 'botanical.care.soilTypeLabels.wellDraining',
  Sandy: 'botanical.care.soilTypeLabels.sandy',
  Loamy: 'botanical.care.soilTypeLabels.loamy',
  Clay: 'botanical.care.soilTypeLabels.clay',
  Peaty: 'botanical.care.soilTypeLabels.peaty',
  Chalky: 'botanical.care.soilTypeLabels.chalky',
  Rich: 'botanical.care.soilTypeLabels.rich',
  Poor: 'botanical.care.soilTypeLabels.poor',
  'Moisture-retaining': 'botanical.care.soilTypeLabels.moistureRetaining',
};

export function getSunlightLabels(sunlight: string[] | null | undefined): string[] {
  return (sunlight ?? []).map((s) => SUNLIGHT_KEY[s] ?? s);
}

export function getWateringLabel(watering: string | null | undefined): string | null {
  return watering ? (WATERING_KEY[watering] ?? watering) : null;
}

export function getSoilTypeLabels(soilTypes: string[] | null | undefined): string[] {
  return (soilTypes ?? []).map((s) => PREFERRED_SOIL_KEY[s] ?? s);
}

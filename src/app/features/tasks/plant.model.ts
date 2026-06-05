export type ContainerVector =
  | 'Terracotta'
  | 'Plastic'
  | 'Ceramic'
  | 'Fabric'
  | 'Self-Watering'
  | 'Ground';

export const CONTAINER_VECTOR_OPTIONS: ContainerVector[] = [
  'Terracotta',
  'Plastic',
  'Ceramic',
  'Fabric',
  'Self-Watering',
  'Ground',
];

export type SubstrateFactor =
  | 'High-Drainage Aroid'
  | 'Heavy Peat'
  | 'Standard Potting'
  | 'Desert Succulent'
  | 'Sphagnum Moss Mix';

export const SUBSTRATE_FACTOR_OPTIONS: SubstrateFactor[] = [
  'High-Drainage Aroid',
  'Heavy Peat',
  'Standard Potting',
  'Desert Succulent',
  'Sphagnum Moss Mix',
];

export type GrowthStage = 'Seedling' | 'Juvenile' | 'Mature' | 'Dormant';

export const GROWTH_STAGE_OPTIONS: GrowthStage[] = ['Seedling', 'Juvenile', 'Mature', 'Dormant'];

export interface Plant {
  id: string;
  user_id: string;
  zone_id: string;
  common_name: string;
  scientific_name: string | null;
  perenual_id: number | null;
  container_vector: ContainerVector;
  substrate_factor: SubstrateFactor;
  growth_stage: GrowthStage;
  last_checked_at: string | null;
  next_check_due_at: string;
  current_snooze_interval_days: number;
  created_at: string;
  updated_at: string;
}

export interface PlantFormData {
  common_name: string;
  scientific_name: string | null;
  perenual_id: number | null;
  zone_id: string;
  container_vector: ContainerVector;
  substrate_factor: SubstrateFactor;
  growth_stage: GrowthStage;
}

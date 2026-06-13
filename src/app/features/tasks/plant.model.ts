export type ContainerVector =
  | 'Terracotta'
  | 'Plastic'
  | 'Ceramic'
  | 'Fabric'
  | 'Self-Watering'
  | 'Ground';

export const CONTAINER_VECTOR_LABEL_KEYS: Record<ContainerVector, string> = {
  Terracotta: 'tasks.plantForm.containerOptions.terracotta',
  Plastic: 'tasks.plantForm.containerOptions.plastic',
  Ceramic: 'tasks.plantForm.containerOptions.ceramic',
  Fabric: 'tasks.plantForm.containerOptions.fabric',
  'Self-Watering': 'tasks.plantForm.containerOptions.selfWatering',
  Ground: 'tasks.plantForm.containerOptions.ground',
};

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

export const SUBSTRATE_FACTOR_LABEL_KEYS: Record<SubstrateFactor, string> = {
  'High-Drainage Aroid': 'tasks.plantForm.substrateOptions.highDrainageAroid',
  'Heavy Peat': 'tasks.plantForm.substrateOptions.heavyPeat',
  'Standard Potting': 'tasks.plantForm.substrateOptions.standardPotting',
  'Desert Succulent': 'tasks.plantForm.substrateOptions.desertSucculent',
  'Sphagnum Moss Mix': 'tasks.plantForm.substrateOptions.sphagnumMossMix',
};

export const SUBSTRATE_FACTOR_OPTIONS: SubstrateFactor[] = [
  'High-Drainage Aroid',
  'Heavy Peat',
  'Standard Potting',
  'Desert Succulent',
  'Sphagnum Moss Mix',
];

export type GrowthStage = 'Seedling' | 'Juvenile' | 'Mature' | 'Dormant';

export const GROWTH_STAGE_LABEL_KEYS: Record<GrowthStage, string> = {
  Seedling: 'tasks.plantForm.growthStageOptions.seedling',
  Juvenile: 'tasks.plantForm.growthStageOptions.juvenile',
  Mature: 'tasks.plantForm.growthStageOptions.mature',
  Dormant: 'tasks.plantForm.growthStageOptions.dormant',
};

export const GROWTH_STAGE_OPTIONS: GrowthStage[] = ['Seedling', 'Juvenile', 'Mature', 'Dormant'];

export interface Plant {
  id: string;
  user_id: string;
  zone_id: string;
  common_name: string;
  scientific_name: string | null;
  inat_taxon_id: number | null;
  container_vector: ContainerVector;
  substrate_factor: SubstrateFactor;
  growth_stage: GrowthStage;
  pot_diameter_cm?: number | null;
  last_checked_at: string | null;
  next_check_due_at: string;
  current_snooze_interval_days: number;
  created_at: string;
  updated_at: string;
}

export interface PlantFormData {
  common_name: string;
  scientific_name: string | null;
  inat_taxon_id: number | null;
  zone_id: string;
  container_vector: ContainerVector;
  substrate_factor: SubstrateFactor;
  growth_stage: GrowthStage;
  pot_diameter_cm?: number | null;
}

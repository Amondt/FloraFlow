export type SeedStage =
  | 'Stored'
  | 'Sown Indoors'
  | 'Germinated'
  | 'Potted Up'
  | 'Hardened Off'
  | 'Transplanted Outside';

export const SEED_STAGE_LABEL_KEYS: Record<SeedStage | 'All' | 'Archived', string> = {
  All: 'seeds.stages.all',
  Archived: 'seeds.stages.archived',
  Stored: 'seeds.stages.stored',
  'Sown Indoors': 'seeds.stages.sownIndoors',
  Germinated: 'seeds.stages.germinated',
  'Potted Up': 'seeds.stages.pottedUp',
  'Hardened Off': 'seeds.stages.hardenedOff',
  'Transplanted Outside': 'seeds.stages.transplantedOutside',
};

export const SEED_STAGE_OPTIONS: SeedStage[] = [
  'Stored',
  'Sown Indoors',
  'Germinated',
  'Potted Up',
  'Hardened Off',
  'Transplanted Outside',
];

export interface SeedBatch {
  id: string;
  user_id: string;
  common_name: string;
  scientific_name: string | null;
  brand: string | null;
  packet_year: number | null;
  current_stage: SeedStage;
  sown_at: string | null;
  germinated_at: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeedBatchFormData {
  common_name: string;
  scientific_name: string | null;
  brand: string | null;
  packet_year: number | null;
  notes: string | null;
}

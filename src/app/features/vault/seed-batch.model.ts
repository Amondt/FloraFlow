export type SeedStage =
  | 'Stored'
  | 'Sown Indoors'
  | 'Germinated'
  | 'Potted Up'
  | 'Hardened Off'
  | 'Transplanted Outside';

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

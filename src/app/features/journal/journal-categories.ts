import type { Database } from '../../../types/database.types';

export type LogCategoryType = Database['public']['Enums']['log_category_type'];

export const CATEGORY_LABEL: Record<LogCategoryType, string> = {
  Observation: 'Observation',
  Watering: 'Watering',
  Pruning: 'Pruning',
  Repotting: 'Repotting',
  Fertilization: 'Fertilization',
  PestTreatment: 'Pest treatment',
};

export const CATEGORY_ICON: Record<LogCategoryType, string> = {
  Observation: 'pi pi-eye',
  Watering: 'pi pi-cloud',
  Pruning: 'pi pi-wrench',
  Repotting: 'pi pi-box',
  Fertilization: 'pi pi-bolt',
  PestTreatment: 'pi pi-shield',
};

export type WindowOrientation =
  | 'North'
  | 'South'
  | 'East'
  | 'West'
  | 'Northeast'
  | 'Northwest'
  | 'Southeast'
  | 'Southwest'
  | 'None';

export const WINDOW_ORIENTATION_OPTIONS: WindowOrientation[] = [
  'North', 'South', 'East', 'West',
  'Northeast', 'Northwest', 'Southeast', 'Southwest',
  'None',
];

export interface Zone {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  window_orientation: WindowOrientation;
  has_active_ventilation: boolean;
  has_grow_lights: boolean;
  humidity_baseline: number;
  created_at: string;
  updated_at: string;
}

export interface ZoneFormData {
  name: string;
  icon: string;
  window_orientation: WindowOrientation;
  has_active_ventilation: boolean;
  has_grow_lights: boolean;
  humidity_baseline: number;
}

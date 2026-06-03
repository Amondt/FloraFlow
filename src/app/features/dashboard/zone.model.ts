import { FormControl, FormGroup, Validators } from '@angular/forms';

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
  'North',
  'South',
  'East',
  'West',
  'Northeast',
  'Northwest',
  'Southeast',
  'Southwest',
  'None',
];

/** Factory that creates a fresh zone FormGroup with all controls and validators. */
export function createZoneFormGroup() {
  return new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    icon: new FormControl('ri-plant-line', { nonNullable: true }),
    window_orientation: new FormControl<WindowOrientation>('None', { nonNullable: true }),
    has_active_ventilation: new FormControl(false, { nonNullable: true }),
    has_grow_lights: new FormControl(false, { nonNullable: true }),
    humidity_baseline: new FormControl(40, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
  });
}

/** Inferred type of the zone FormGroup, used to type-check inputs across components. */
export type ZoneFormGroup = ReturnType<typeof createZoneFormGroup>;

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

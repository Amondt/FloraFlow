import { Component, computed, effect, input, model, output, untracked } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ButtonModule } from 'primeng/button';
import {
  FloraDialogPT,
  FloraInputTextPT,
  FloraInputNumberPT,
  FloraSelectPT,
  FloraToggleSwitchPT,
  FloraButtonPT,
  FLORA_ERROR,
} from '../../shared/ui/pt/index';
import { Zone, ZoneFormData, WindowOrientation, WINDOW_ORIENTATION_OPTIONS } from './zone.model';

@Component({
  selector: 'app-zone-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    ButtonModule,
  ],
  templateUrl: './zone-form.html',
})
export class ZoneFormComponent {
  readonly visible  = model<boolean>(false);
  readonly editZone = input<Zone | null>(null);
  readonly saved    = output<ZoneFormData>();

  protected readonly FloraDialogPT       = FloraDialogPT;
  protected readonly FloraInputTextPT    = FloraInputTextPT;
  protected readonly FloraInputNumberPT  = FloraInputNumberPT;
  protected readonly FloraSelectPT       = FloraSelectPT;
  protected readonly FloraToggleSwitchPT = FloraToggleSwitchPT;
  protected readonly FloraButtonPT       = FloraButtonPT;
  protected readonly FLORA_ERROR         = FLORA_ERROR;
  protected readonly orientationOptions  = WINDOW_ORIENTATION_OPTIONS;

  readonly dialogTitle = computed(() => this.editZone() ? 'Edit Zone' : 'Add Zone');

  protected readonly nameId        = `flora-zone-name-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly humidityId    = `flora-zone-humidity-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly orientationId = `flora-zone-orientation-${crypto.randomUUID().slice(0, 8)}`;

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(80)],
    }),
    icon: new FormControl('ri-plant-line', { nonNullable: true }),
    window_orientation: new FormControl<WindowOrientation>('None', { nonNullable: true }),
    has_active_ventilation: new FormControl(false, { nonNullable: true }),
    has_grow_lights:        new FormControl(false, { nonNullable: true }),
    humidity_baseline: new FormControl(40, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(100)],
    }),
  });

  // Sync the form only when the dialog transitions from hidden → visible.
  // Using untracked() for editZone so the effect only re-runs on visible() changes,
  // not on every select/input interaction that may re-notify the signal.
  private _prevVisible = false;

  private readonly _syncFormEffect = effect(() => {
    const isVisible = this.visible();
    const justOpened = isVisible && !this._prevVisible;
    this._prevVisible = isVisible;

    if (!justOpened) return;

    const zone = untracked(() => this.editZone());
    if (zone) {
      this.form.patchValue({
        name:                   zone.name,
        icon:                   zone.icon,
        window_orientation:     zone.window_orientation,
        has_active_ventilation: zone.has_active_ventilation,
        has_grow_lights:        zone.has_grow_lights,
        humidity_baseline:      zone.humidity_baseline,
      });
    } else {
      this.form.reset({
        name:                   '',
        icon:                   'ri-plant-line',
        window_orientation:     'None',
        has_active_ventilation: false,
        has_grow_lights:        false,
        humidity_baseline:      40,
      });
    }
  });

  get nameCtrl()     { return this.form.controls.name; }
  get humidityCtrl() { return this.form.controls.humidity_baseline; }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saved.emit(this.form.getRawValue() as ZoneFormData);
    this.visible.set(false);
  }

  onCancel(): void {
    this.visible.set(false);
  }
}

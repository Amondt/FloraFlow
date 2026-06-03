import {
  Component,
  computed,
  effect,
  input,
  model,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FloraDialogPT, FloraButtonPT } from '../../../shared/ui/pt/index';
import { createZoneFormGroup, Zone, ZoneFormData } from '../zone.model';
import { ZoneFormFieldsComponent } from '../zone-form-fields/zone-form-fields';

@Component({
  selector: 'app-zone-form',
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, ButtonModule, ZoneFormFieldsComponent],
  templateUrl: './zone-form.html',
})
export class ZoneFormComponent {
  readonly visible = model<boolean>(false);
  readonly editZone = input<Zone | null>(null);
  readonly saved = output<ZoneFormData>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;

  readonly dialogTitle = computed(() => (this.editZone() ? 'Edit Zone' : 'Add Zone'));

  readonly form = createZoneFormGroup();

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
        name: zone.name,
        icon: zone.icon,
        window_orientation: zone.window_orientation,
        has_active_ventilation: zone.has_active_ventilation,
        has_grow_lights: zone.has_grow_lights,
        humidity_baseline: zone.humidity_baseline,
      });
    } else {
      this.form.reset({
        name: '',
        icon: 'ri-plant-line',
        window_orientation: 'None',
        has_active_ventilation: false,
        has_grow_lights: false,
        humidity_baseline: 40,
      });
    }
  });

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

  private readonly fieldsComp = viewChild(ZoneFormFieldsComponent);

  /** Close any open overlays (e.g. orientation select) when the dialog hides. */
  onHide(): void {
    this.fieldsComp()?.closeOverlays();
  }
}

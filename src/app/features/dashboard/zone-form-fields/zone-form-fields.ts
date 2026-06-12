import { Component, computed, effect, input, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReactiveFormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { Select, SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  FloraInputTextPT,
  FloraInputNumberPT,
  FloraSelectPT,
  FloraToggleSwitchPT,
  FLORA_ERROR,
  FLORA_FOCUS,
} from '../../../shared/ui/pt/index';
import { WINDOW_ORIENTATION_OPTIONS, ZoneFormGroup, ZoneType } from '../zone.model';

@Component({
  selector: 'app-zone-form-fields',
  standalone: true,
  // host class makes this element a flex column — the parent form's gap-5 then
  // applies between this block and the error/button below it, while the fields
  // inside have their own gap-5 from this host container.
  host: { class: 'flex flex-col gap-5' },
  imports: [
    ReactiveFormsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    TranslocoPipe,
  ],
  templateUrl: './zone-form-fields.html',
})
export class ZoneFormFieldsComponent {
  readonly form = input.required<ZoneFormGroup>();

  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraInputNumberPT = FloraInputNumberPT;
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraToggleSwitchPT = FloraToggleSwitchPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;
  protected readonly orientationOptions = WINDOW_ORIENTATION_OPTIONS;

  protected readonly nameId = `flora-zone-name-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly orientationId = `flora-zone-orientation-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly humidityId = `flora-zone-humidity-${crypto.randomUUID().slice(0, 8)}`;

  protected readonly nameCtrl = computed(() => this.form().controls.name);
  protected readonly humidityCtrl = computed(() => this.form().controls.humidity_baseline);

  private readonly _zoneTypeSig = signal<ZoneType>('indoor');
  protected readonly zoneType = this._zoneTypeSig.asReadonly();

  private readonly orientationSelect = viewChild<Select>('orientationSelect');

  constructor() {
    // Bridge zone_type form control → signal so @if conditions react to both
    // user button clicks and programmatic patchValue/reset from the parent dialog.
    effect((onCleanup) => {
      const ctrl = this.form().controls.zone_type;
      this._zoneTypeSig.set(ctrl.value);
      const sub = ctrl.valueChanges.subscribe((v) => this._zoneTypeSig.set(v));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected selectZoneType(type: ZoneType): void {
    this.form().controls.zone_type.setValue(type);
    if (type === 'outdoor') {
      this.form().controls.window_orientation.setValue('None');
      this.form().controls.has_active_ventilation.setValue(false);
      this.form().controls.has_grow_lights.setValue(false);
      this.form().controls.humidity_baseline.setValue(40);
    }
  }

  protected zoneTypeBtnClass(type: ZoneType): string {
    const base = `flex flex-col items-center text-center gap-1 p-3 rounded-garden-md border-2 w-full text-sm font-medium font-display cursor-pointer transition-colors duration-150 ${FLORA_FOCUS}`;
    return this.zoneType() === type
      ? `${base} border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:border-primary-500 dark:text-primary-400`
      : `${base} border-neutral-200 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400 hover:border-neutral-300 hover:text-neutral-700 dark:hover:border-neutral-600`;
  }

  /** Close any open overlay panels — called by the parent dialog on hide. */
  closeOverlays(): void {
    this.orientationSelect()?.hide();
  }
}

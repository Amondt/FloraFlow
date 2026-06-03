import { Component, computed, input, viewChild } from '@angular/core';
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
} from '../../../shared/ui/pt/index';
import { WINDOW_ORIENTATION_OPTIONS, ZoneFormGroup } from '../zone.model';

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

  private readonly orientationSelect = viewChild<Select>('orientationSelect');

  /** Close any open overlay panels — called by the parent dialog on hide. */
  closeOverlays(): void {
    this.orientationSelect()?.hide();
  }
}

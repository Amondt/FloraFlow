import { Component, effect, inject, input, model, output, computed } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import {
  FloraDialogPT,
  FloraInputTextPT,
  FloraSelectPT,
  FloraButtonPT,
  FLORA_ERROR,
} from '../../shared/ui/pt/index';
import { ZoneService } from '../dashboard/zone.service';
import {
  Plant,
  PlantFormData,
  ContainerVector,
  SubstrateFactor,
  CONTAINER_VECTOR_OPTIONS,
  SUBSTRATE_FACTOR_OPTIONS,
} from './plant.model';

@Component({
  selector: 'app-plant-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, InputTextModule, SelectModule, ButtonModule],
  templateUrl: './plant-form-dialog.html',
})
export class PlantFormDialogComponent {
  private readonly zoneService = inject(ZoneService);

  readonly plant   = input<Plant | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved            = output<PlantFormData>();
  readonly deleteRequested  = output<Plant>();

  protected readonly FloraDialogPT    = FloraDialogPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraSelectPT    = FloraSelectPT;
  protected readonly FloraButtonPT    = FloraButtonPT;
  protected readonly FLORA_ERROR      = FLORA_ERROR;

  protected readonly CONTAINER_VECTOR_OPTIONS = CONTAINER_VECTOR_OPTIONS;
  protected readonly SUBSTRATE_FACTOR_OPTIONS = SUBSTRATE_FACTOR_OPTIONS;

  protected readonly commonNameId = `flora-plant-name-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly scientificId = `flora-plant-sci-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly zoneSelectId = `flora-plant-zone-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly containerId  = `flora-plant-ct-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly substrateId  = `flora-plant-sf-${crypto.randomUUID().slice(0, 8)}`;

  readonly form = new FormGroup({
    common_name:      new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    scientific_name:  new FormControl<string | null>(null),
    zone_id:          new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    container_vector: new FormControl<ContainerVector>('Plastic', { nonNullable: true }),
    substrate_factor: new FormControl<SubstrateFactor>('Standard Potting', { nonNullable: true }),
  });

  readonly dialogTitle  = computed(() => this.plant() ? 'Edit Plant' : 'Add Plant');
  readonly zoneOptions  = computed(() => this.zoneService.zones().map(z => ({ label: z.name, value: z.id })));

  get nameCtrl()   { return this.form.controls.common_name; }
  get zoneCtrl()   { return this.form.controls.zone_id; }

  private _prevVisible = false;

  constructor() {
    if (this.zoneService.zones().length === 0) {
      void this.zoneService.loadZones();
    }

    effect(() => {
      const isVisible = this.visible();
      const p = this.plant();
      const justOpened = isVisible && !this._prevVisible;
      this._prevVisible = isVisible;

      if (!justOpened) return;

      if (p) {
        this.form.patchValue({
          common_name:      p.common_name,
          scientific_name:  p.scientific_name,
          zone_id:          p.zone_id,
          container_vector: p.container_vector,
          substrate_factor: p.substrate_factor,
        });
      } else {
        this.form.reset({
          common_name:      '',
          scientific_name:  null,
          zone_id:          '',
          container_vector: 'Plastic',
          substrate_factor: 'Standard Potting',
        });
      }
    });
  }

  onVisibleChange(v: boolean): void {
    if (!v) this.blurActive();
    this.visible.set(v);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const data: PlantFormData = {
      common_name:      this.form.controls.common_name.value,
      scientific_name:  this.form.controls.scientific_name.value || null,
      zone_id:          this.form.controls.zone_id.value,
      container_vector: this.form.controls.container_vector.value,
      substrate_factor: this.form.controls.substrate_factor.value,
    };

    this.saved.emit(data);
    this.close();
  }

  onDelete(): void {
    const p = this.plant();
    if (p) {
      this.deleteRequested.emit(p);
    }
  }

  onCancel(): void {
    this.close();
  }

  private close(): void {
    this.blurActive();
    this.visible.set(false);
  }

  private blurActive(): void {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}

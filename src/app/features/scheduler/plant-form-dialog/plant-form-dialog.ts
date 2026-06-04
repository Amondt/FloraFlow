import {
  Component,
  effect,
  inject,
  input,
  model,
  output,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AutoComplete, AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Select, SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import {
  FloraDialogPT,
  FloraInputTextPT,
  FloraAutoCompletePT,
  FloraSelectPT,
  FloraButtonPT,
  FLORA_ERROR,
} from '../../../shared/ui/pt/index';
import { blurActiveElement } from '../../../shared/utils/dom';
import { ZoneService } from '../../dashboard/zone.service';
import {
  BotanicalSearchService,
  BotanicalSuggestion,
} from '../../../core/services/botanical-search.service';
import {
  Plant,
  PlantFormData,
  ContainerVector,
  SubstrateFactor,
  GrowthStage,
  CONTAINER_VECTOR_OPTIONS,
  SUBSTRATE_FACTOR_OPTIONS,
  GROWTH_STAGE_OPTIONS,
} from '../plant.model';

@Component({
  selector: 'app-plant-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    InputTextModule,
    AutoCompleteModule,
    SelectModule,
    ButtonModule,
  ],
  templateUrl: './plant-form-dialog.html',
})
export class PlantFormDialogComponent {
  private readonly zoneService = inject(ZoneService);
  private readonly botanicalSearch = inject(BotanicalSearchService);

  readonly plant = input<Plant | null>(null);
  readonly defaultZoneId = input<string | null>(null);
  readonly botanicalPrefill = input<{
    common_name: string;
    scientific_name: string | null;
    perenual_id: number | null;
  } | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<PlantFormData>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraAutoCompletePT = FloraAutoCompletePT;
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;

  protected readonly CONTAINER_VECTOR_OPTIONS = CONTAINER_VECTOR_OPTIONS;
  protected readonly SUBSTRATE_FACTOR_OPTIONS = SUBSTRATE_FACTOR_OPTIONS;
  protected readonly GROWTH_STAGE_OPTIONS = GROWTH_STAGE_OPTIONS;

  protected readonly commonNameId = `flora-plant-name-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly scientificId = `flora-plant-sci-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly zoneSelectId = `flora-plant-zone-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly containerId = `flora-plant-ct-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly substrateId = `flora-plant-sf-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly growthStageId = `flora-plant-gs-${crypto.randomUUID().slice(0, 8)}`;

  protected suggestions = signal<BotanicalSuggestion[]>([]);
  protected selectedPerenualId = signal<number | null>(null);
  protected lockedScientificName = signal<string | null>(null);
  protected commonNameQuery = '';

  readonly form = new FormGroup({
    common_name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    scientific_name: new FormControl<string | null>(null),
    zone_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    container_vector: new FormControl<ContainerVector>('Plastic', { nonNullable: true }),
    substrate_factor: new FormControl<SubstrateFactor>('Standard Potting', { nonNullable: true }),
    growth_stage: new FormControl<GrowthStage>('Mature', { nonNullable: true }),
  });

  readonly dialogTitle = computed(() => (this.plant() ? 'Edit Plant' : 'Add Plant'));
  readonly zoneOptions = computed(() =>
    this.zoneService.zones().map((z) => ({ label: z.name, value: z.id })),
  );

  get nameCtrl() {
    return this.form.controls.common_name;
  }
  get zoneCtrl() {
    return this.form.controls.zone_id;
  }

  private readonly _plantNameAC = viewChild<AutoComplete>('plantNameAC');
  private readonly _zoneSelect = viewChild<Select>('zoneSelect');
  private readonly _containerSelect = viewChild<Select>('containerSelect');
  private readonly _substrateSelect = viewChild<Select>('substrateSelect');
  private readonly _growthStageSelect = viewChild<Select>('growthStageSelect');

  private _prevVisible = false;

  constructor() {
    if (this.zoneService.zones().length === 0) {
      void this.zoneService.loadZones();
    }

    effect(() => {
      const isVisible = this.visible();
      const p = this.plant();
      const defaultZoneId = this.defaultZoneId();
      const justOpened = isVisible && !this._prevVisible;
      this._prevVisible = isVisible;

      if (!justOpened) return;

      if (p) {
        this.commonNameQuery = p.common_name;
        this.selectedPerenualId.set(p.perenual_id);
        this.lockedScientificName.set(p.perenual_id ? p.scientific_name : null);
        this.form.patchValue({
          common_name: p.common_name,
          scientific_name: p.scientific_name,
          zone_id: p.zone_id,
          container_vector: p.container_vector,
          substrate_factor: p.substrate_factor,
          growth_stage: p.growth_stage,
        });
      } else {
        this.form.reset({
          common_name: '',
          scientific_name: null,
          zone_id: defaultZoneId ?? this.zoneService.zones()[0]?.id ?? '',
          container_vector: 'Plastic',
          substrate_factor: 'Standard Potting',
          growth_stage: 'Mature',
        });

        const prefill = this.botanicalPrefill();
        if (prefill) {
          this.commonNameQuery = prefill.common_name;
          this.selectedPerenualId.set(prefill.perenual_id);
          this.lockedScientificName.set(prefill.perenual_id ? prefill.scientific_name : null);
          this.form.patchValue({
            common_name: prefill.common_name,
            scientific_name: prefill.scientific_name,
          });
        } else {
          this.commonNameQuery = '';
          this.selectedPerenualId.set(null);
          this.lockedScientificName.set(null);
        }
      }
    });
  }

  onVisibleChange(v: boolean): void {
    if (!v) blurActiveElement();
    this.visible.set(v);
  }

  onHide(): void {
    this._plantNameAC()?.hide();
    this._zoneSelect()?.hide();
    this._containerSelect()?.hide();
    this._substrateSelect()?.hide();
    this._growthStageSelect()?.hide();
  }

  async onQuerySearch(event: AutoCompleteCompleteEvent): Promise<void> {
    if (this.selectedPerenualId() !== null) {
      this.suggestions.set([]);
      return;
    }
    this.suggestions.set(await this.botanicalSearch.search(event.query));
  }

  onCommonNameChange(value: string | BotanicalSuggestion | null): void {
    if (!value || typeof value === 'string') {
      this.commonNameQuery = value ?? '';
      this.form.controls.common_name.setValue(value ?? '');
      // Only clear the species lock when no species is currently selected.
      // When locked, typing freely just renames the plant — lock stays until
      // the user explicitly clicks "Change species".
      if (this.selectedPerenualId() === null) {
        this.lockedScientificName.set(null);
      }
    } else {
      this.commonNameQuery = value.common_name;
      this.form.controls.common_name.setValue(value.common_name);
      this.form.controls.scientific_name.setValue(value.scientific_name);
      this.selectedPerenualId.set(value.perenual_id);
      this.lockedScientificName.set(value.scientific_name);
      this.suggestions.set([]);
    }
  }

  clearLockedSpecies(): void {
    this.selectedPerenualId.set(null);
    this.lockedScientificName.set(null);
    this.commonNameQuery = '';
    this.form.controls.common_name.setValue('');
    this.form.controls.scientific_name.setValue(null);
    this.suggestions.set([]);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const data: PlantFormData = {
      common_name: this.form.controls.common_name.value,
      scientific_name: this.form.controls.scientific_name.value || null,
      perenual_id: this.selectedPerenualId(),
      zone_id: this.form.controls.zone_id.value,
      container_vector: this.form.controls.container_vector.value,
      substrate_factor: this.form.controls.substrate_factor.value,
      growth_stage: this.form.controls.growth_stage.value,
    };

    this.saved.emit(data);
    this.close();
  }

  onCancel(): void {
    this.close();
  }

  private close(): void {
    blurActiveElement();
    this.visible.set(false);
  }
}

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
import { InputNumberModule } from 'primeng/inputnumber';
import { AutoComplete, AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { Select, SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import {
  PlantIdentifierDialogComponent,
  type PlantIdentifiedEvent,
} from '../../../shared/components/plant-identifier/plant-identifier-dialog';
import {
  FloraFormDialogPT,
  FloraInputTextPT,
  FloraInputNumberPT,
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
    InputNumberModule,
    AutoCompleteModule,
    SelectModule,
    ButtonModule,
    LeafIconComponent,
    PlantIdentifierDialogComponent,
  ],
  templateUrl: './plant-form-dialog.html',
})
export class PlantFormDialogComponent {
  private readonly zoneService = inject(ZoneService);
  private readonly botanicalSearch = inject(BotanicalSearchService);
  private readonly messageService = inject(MessageService, { optional: true });

  readonly plant = input<Plant | null>(null);
  readonly defaultZoneId = input<string | null>(null);
  readonly botanicalPrefill = input<{
    common_name: string;
    scientific_name: string | null;
    perenual_id: number | null;
  } | null>(null);
  readonly visible = model<boolean>(false);
  readonly saved = output<PlantFormData>();

  protected readonly FloraFormDialogPT = FloraFormDialogPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraInputNumberPT = FloraInputNumberPT;
  protected readonly FloraAutoCompletePT = FloraAutoCompletePT;
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;

  protected readonly CONTAINER_VECTOR_OPTIONS = CONTAINER_VECTOR_OPTIONS;
  protected readonly SUBSTRATE_FACTOR_OPTIONS = SUBSTRATE_FACTOR_OPTIONS;
  protected readonly GROWTH_STAGE_OPTIONS = GROWTH_STAGE_OPTIONS;

  protected readonly speciesSearchId = `flora-plant-species-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly nicknameId = `flora-plant-name-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly zoneSelectId = `flora-plant-zone-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly containerId = `flora-plant-ct-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly substrateId = `flora-plant-sf-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly potDiameterId = `flora-plant-pd-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly growthStageId = `flora-plant-gs-${crypto.randomUUID().slice(0, 8)}`;

  readonly identifierVisible = signal(false);
  protected suggestions = signal<BotanicalSuggestion[]>([]);
  protected selectedPerenualId = signal<number | null>(null);
  protected lockedScientificName = signal<string | null>(null);
  protected readonly lockedSpeciesCommonName = signal<string | null>(null);
  protected speciesSearchQuery = '';

  readonly form = new FormGroup({
    common_name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    scientific_name: new FormControl<string | null>(null),
    zone_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    container_vector: new FormControl<ContainerVector>('Plastic', { nonNullable: true }),
    substrate_factor: new FormControl<SubstrateFactor>('Standard Potting', { nonNullable: true }),
    pot_diameter_cm: new FormControl<number | null>(null),
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
        this.speciesSearchQuery = p.perenual_id ? p.common_name : '';
        this.selectedPerenualId.set(p.perenual_id);
        this.lockedScientificName.set(p.perenual_id ? p.scientific_name : null);
        this.lockedSpeciesCommonName.set(p.perenual_id ? p.common_name : null);
        this.form.patchValue({
          common_name: p.common_name,
          scientific_name: p.scientific_name,
          zone_id: p.zone_id,
          container_vector: p.container_vector,
          substrate_factor: p.substrate_factor,
          pot_diameter_cm: p.pot_diameter_cm ?? null,
          growth_stage: p.growth_stage,
        });
      } else {
        this.form.reset({
          common_name: '',
          scientific_name: null,
          zone_id: defaultZoneId ?? this.zoneService.zones()[0]?.id ?? '',
          container_vector: 'Plastic',
          substrate_factor: 'Standard Potting',
          pot_diameter_cm: null,
          growth_stage: 'Mature',
        });

        const prefill = this.botanicalPrefill();
        if (prefill) {
          this.speciesSearchQuery = prefill.common_name;
          this.selectedPerenualId.set(prefill.perenual_id);
          this.lockedScientificName.set(prefill.perenual_id ? prefill.scientific_name : null);
          this.lockedSpeciesCommonName.set(prefill.perenual_id ? prefill.common_name : null);
          this.form.patchValue({
            common_name: prefill.common_name,
            scientific_name: prefill.scientific_name,
          });
        } else {
          this.speciesSearchQuery = '';
          this.selectedPerenualId.set(null);
          this.lockedScientificName.set(null);
          this.lockedSpeciesCommonName.set(null);
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
    this.identifierVisible.set(false);
  }

  protected openIdentifier(): void {
    this.identifierVisible.set(true);
  }

  protected onIdentified(event: PlantIdentifiedEvent): void {
    this.form.patchValue({
      common_name: event.common_name,
      scientific_name: event.scientific_name,
    });
    this.speciesSearchQuery = event.common_name;
    this.selectedPerenualId.set(event.perenual_id);
    this.lockedScientificName.set(event.perenual_id ? event.scientific_name : null);
    this.lockedSpeciesCommonName.set(event.perenual_id ? event.common_name : null);
    this.identifierVisible.set(false);
    this.messageService?.add({
      severity: 'success',
      summary: 'Species identified',
      detail: 'Form pre-filled — adjust if needed.',
    });
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
      this.speciesSearchQuery = value ?? '';
      if (this.selectedPerenualId() === null) {
        this.lockedScientificName.set(null);
        this.lockedSpeciesCommonName.set(null);
      }
    } else {
      this.speciesSearchQuery = value.common_name;
      if (!this.form.controls.common_name.value) {
        this.form.controls.common_name.setValue(value.common_name);
      }
      this.form.controls.scientific_name.setValue(value.scientific_name);
      this.selectedPerenualId.set(value.perenual_id);
      this.lockedSpeciesCommonName.set(value.common_name);
      this.lockedScientificName.set(value.scientific_name);
      this.suggestions.set([]);
    }
  }

  clearLockedSpecies(): void {
    this.selectedPerenualId.set(null);
    this.lockedScientificName.set(null);
    this.lockedSpeciesCommonName.set(null);
    this.speciesSearchQuery = '';
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
      inat_taxon_id: null,
      zone_id: this.form.controls.zone_id.value,
      container_vector: this.form.controls.container_vector.value,
      substrate_factor: this.form.controls.substrate_factor.value,
      pot_diameter_cm: this.form.controls.pot_diameter_cm.value,
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

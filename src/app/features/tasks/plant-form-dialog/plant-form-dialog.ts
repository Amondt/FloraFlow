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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { BotanicalTagsComponent } from '../../../shared/components/botanical-tags/botanical-tags';
import {
  PlantIdentifierDialogComponent,
  type PlantIdentifiedEvent,
} from '../../../shared/components/plant-identifier/plant-identifier-dialog';
import { LibraryService, type CachedBotanicalRecord } from '../../library/library.service';
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
    TranslocoPipe,
    LeafIconComponent,
    BotanicalTagsComponent,
    PlantIdentifierDialogComponent,
  ],
  templateUrl: './plant-form-dialog.html',
})
export class PlantFormDialogComponent {
  private readonly zoneService = inject(ZoneService);
  private readonly t = inject(TranslocoService);
  private readonly botanicalSearch = inject(BotanicalSearchService);
  private readonly _libraryService = inject(LibraryService);
  private readonly messageService = inject(MessageService, { optional: true });

  readonly plant = input<Plant | null>(null);
  readonly defaultZoneId = input<string | null>(null);
  readonly botanicalPrefill = input<{
    common_name: string;
    scientific_name: string | null;
    inat_taxon_id: number | null;
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
  protected selectedInatTaxonId = signal<number | null>(null);
  protected lockedScientificName = signal<string | null>(null);
  protected readonly lockedSpeciesCommonName = signal<string | null>(null);
  protected readonly lockedThumbnailUrl = signal<string | null>(null);
  protected readonly lockedBotanicalRecord = signal<CachedBotanicalRecord | null>(null);
  protected readonly isLoadingBotanicalRecord = signal(false);
  protected readonly isSpeciesLocked = computed(
    () => this.selectedInatTaxonId() !== null || this.lockedScientificName() !== null,
  );
  private _botanicalFetchGeneration = 0;
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

  readonly dialogTitle = computed(() =>
    this.plant()
      ? this.t.translate('tasks.plantForm.dialogTitleEdit')
      : this.t.translate('tasks.plantForm.dialogTitleAdd'),
  );
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

      this.lockedThumbnailUrl.set(null);
      this.lockedBotanicalRecord.set(null);
      this.isLoadingBotanicalRecord.set(false);
      ++this._botanicalFetchGeneration;

      if (p) {
        const hasSpeciesLink = !!p.inat_taxon_id;
        this.speciesSearchQuery = hasSpeciesLink ? p.common_name : '';
        this.selectedInatTaxonId.set(p.inat_taxon_id);
        this.lockedScientificName.set(hasSpeciesLink ? p.scientific_name : null);
        this.lockedSpeciesCommonName.set(hasSpeciesLink ? p.common_name : null);
        this.form.patchValue({
          common_name: p.common_name,
          scientific_name: p.scientific_name,
          zone_id: p.zone_id,
          container_vector: p.container_vector,
          substrate_factor: p.substrate_factor,
          pot_diameter_cm: p.pot_diameter_cm ?? null,
          growth_stage: p.growth_stage,
        });
        if (hasSpeciesLink && p.scientific_name) {
          this._fetchBotanicalRecord(p.scientific_name);
        }
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
          const hasSpeciesLink = !!prefill.inat_taxon_id || !!prefill.scientific_name;
          this.speciesSearchQuery = prefill.common_name;
          this.selectedInatTaxonId.set(prefill.inat_taxon_id);
          this.lockedScientificName.set(hasSpeciesLink ? prefill.scientific_name : null);
          this.lockedSpeciesCommonName.set(hasSpeciesLink ? prefill.common_name : null);
          this.form.patchValue({
            common_name: prefill.common_name,
            scientific_name: prefill.scientific_name,
          });
          if (hasSpeciesLink && prefill.scientific_name) {
            this._fetchBotanicalRecord(prefill.scientific_name);
          }
        } else {
          this.speciesSearchQuery = '';
          this.selectedInatTaxonId.set(null);
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
    const hasSpeciesLink = !!event.inat_taxon_id;
    this.form.patchValue({
      common_name: event.common_name,
      scientific_name: event.scientific_name,
    });
    this.speciesSearchQuery = event.common_name;
    this.selectedInatTaxonId.set(event.inat_taxon_id);
    this.lockedScientificName.set(hasSpeciesLink ? event.scientific_name : null);
    this.lockedSpeciesCommonName.set(hasSpeciesLink ? event.common_name : null);
    this.lockedThumbnailUrl.set(null);
    if (event.scientific_name) {
      this._fetchBotanicalRecord(event.scientific_name);
    }
    this.identifierVisible.set(false);
    this.messageService?.add({
      severity: 'success',
      summary: this.t.translate('tasks.plantForm.toast.speciesIdentified'),
      detail: this.t.translate('tasks.plantForm.toast.speciesIdentifiedDetail'),
    });
  }

  async onQuerySearch(event: AutoCompleteCompleteEvent): Promise<void> {
    if (this.selectedInatTaxonId() !== null) {
      this.suggestions.set([]);
      return;
    }
    this.suggestions.set(await this.botanicalSearch.search(event.query));
  }

  onCommonNameChange(value: string | BotanicalSuggestion | null): void {
    if (!value || typeof value === 'string') {
      this.speciesSearchQuery = value ?? '';
      if (this.selectedInatTaxonId() === null) {
        this.lockedScientificName.set(null);
        this.lockedSpeciesCommonName.set(null);
      }
    } else {
      this.speciesSearchQuery = value.common_name;
      if (!this.form.controls.common_name.value) {
        this.form.controls.common_name.setValue(value.common_name);
      }
      this.form.controls.scientific_name.setValue(value.scientific_name);
      this.selectedInatTaxonId.set(value.inat_taxon_id);
      this.lockedSpeciesCommonName.set(value.common_name);
      this.lockedScientificName.set(value.scientific_name);
      this.lockedThumbnailUrl.set(value.thumbnail_url);
      this._fetchBotanicalRecord(value.scientific_name);
      this.suggestions.set([]);
    }
  }

  clearLockedSpecies(): void {
    ++this._botanicalFetchGeneration;
    this.selectedInatTaxonId.set(null);
    this.lockedScientificName.set(null);
    this.lockedSpeciesCommonName.set(null);
    this.lockedThumbnailUrl.set(null);
    this.lockedBotanicalRecord.set(null);
    this.isLoadingBotanicalRecord.set(false);
    this.speciesSearchQuery = '';
    this.form.controls.scientific_name.setValue(null);
    this.suggestions.set([]);
  }

  private _fetchBotanicalRecord(scientificName: string): void {
    const myGeneration = ++this._botanicalFetchGeneration;
    this.isLoadingBotanicalRecord.set(true);
    this._libraryService
      .fetchByScientificName(scientificName)
      .then((record) => {
        if (myGeneration !== this._botanicalFetchGeneration) return;
        this.lockedBotanicalRecord.set(record);
      })
      .catch(() => {
        if (myGeneration !== this._botanicalFetchGeneration) return;
        this.lockedBotanicalRecord.set(null);
      })
      .finally(() => {
        if (myGeneration !== this._botanicalFetchGeneration) return;
        this.isLoadingBotanicalRecord.set(false);
      });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const data: PlantFormData = {
      common_name: this.form.controls.common_name.value,
      scientific_name: this.form.controls.scientific_name.value || null,
      inat_taxon_id: this.selectedInatTaxonId(),
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

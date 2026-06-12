import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  FloraFormDialogPT,
  FloraButtonPT,
  FloraMessagePT,
  FloraTextareaPT,
  FLORA_FOCUS,
  FLORA_DISABLED,
} from '../../../shared/ui/pt/index';
import { PlantService } from '../../tasks/plant.service';
import { ZoneService } from '../../dashboard/zone.service';
import {
  JournalService,
  type LeafDoctorDiagnostics,
  type LeafDoctorResult,
  type HealthyDiagnosticsBlob,
} from '../journal.service';
import { LibraryService } from '../../library/library.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { blurActiveElement } from '../../../shared/utils/dom';
import {
  PlantSelectComponent,
  type PlantOption,
  type PlantOptionGroup,
} from '../../../shared/components/plant-select/plant-select';
import { LeafDoctorBadgesComponent } from '../leaf-doctor-badges/leaf-doctor-badges';
import type { Json } from '../../../../types/database.types';

@Component({
  selector: 'app-leaf-doctor-dialog',
  standalone: true,
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    MessageModule,
    TextareaModule,
    TranslocoPipe,
    PlantSelectComponent,
    LeafDoctorBadgesComponent,
  ],
  templateUrl: './leaf-doctor-dialog.html',
})
export class LeafDoctorDialogComponent implements OnDestroy {
  private readonly plantService = inject(PlantService);
  private readonly zoneService = inject(ZoneService);
  private readonly journalService = inject(JournalService);
  private readonly libraryService = inject(LibraryService);
  private readonly compressor = inject(ImageCompressorService);
  private readonly supabase = inject(SupabaseService);
  private readonly messageService = inject(MessageService);
  private readonly t = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = model<boolean>(false);
  readonly preselectedPlantId = input<string | null>(null);
  readonly entrySaved = output<void>();

  protected readonly FloraFormDialogPT = FloraFormDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraTextareaPT = FloraTextareaPT;
  protected readonly FLORA_FOCUS = FLORA_FOCUS;
  protected readonly FLORA_DISABLED = FLORA_DISABLED;

  readonly symptomNotesId = `flora-${crypto.randomUUID().slice(0, 8)}`;

  protected readonly photoInputRef = viewChild<ElementRef<HTMLInputElement>>('photoInputRef');
  private readonly _plantSelect = viewChild<PlantSelectComponent>('plantSelectRef');

  readonly selectedPlantId = signal<string | null>(null);
  readonly symptomNotes = signal<string>('');
  private readonly plantThumbnailMap = signal<Map<string, string | null>>(new Map());

  readonly compressedBlobs = signal<Blob[]>([]);
  readonly previewObjectUrls = signal<string[]>([]);
  readonly compressedLabels = signal<string[]>([]);
  readonly isCompressing = signal(false);

  readonly diagnosisState = signal<
    'idle' | 'loading' | 'success' | 'healthy' | 'error' | 'not-botanical'
  >('idle');
  readonly diagnosisResult = signal<LeafDoctorDiagnostics | null>(null);
  readonly speciesMismatchName = signal<string | null>(null);
  readonly identifiedPlant = signal<string | null>(null);
  readonly saving = signal(false);

  protected readonly hasPhotos = computed(() => this.compressedBlobs().length > 0);
  protected readonly canAddPhoto = computed(() => this.compressedBlobs().length < 3);

  protected readonly plantOptions = computed((): PlantOptionGroup[] => {
    const plants = this.plantService.plants();
    const zones = this.zoneService.zones();
    const thumbnailMap = this.plantThumbnailMap();

    const groups = new Map<string, PlantOptionGroup>(
      zones.map((z) => [z.id, { label: z.name, items: [] }]),
    );
    const ungrouped: PlantOption[] = [];

    for (const p of plants) {
      const option: PlantOption = {
        label: p.common_name,
        value: p.id,
        scientificName: p.scientific_name ?? null,
        thumbnailUrl: p.scientific_name ? (thumbnailMap.get(p.scientific_name) ?? null) : null,
      };
      const group = groups.get(p.zone_id);
      if (group) {
        group.items.push(option);
      } else {
        ungrouped.push(option);
      }
    }

    const result: PlantOptionGroup[] = [...[...groups.values()].filter((g) => g.items.length > 0)];
    if (ungrouped.length > 0) {
      result.push({ label: this.t.translate('leafDoctor.otherGroup'), items: ungrouped });
    }
    return result;
  });

  protected readonly selectedPlantContext = computed(
    (): {
      commonName: string;
      scientificName: string | null;
    } | null => {
      const id = this.selectedPlantId();
      if (!id) return null;
      for (const group of this.plantOptions()) {
        const option = group.items.find((o) => o.value === id);
        if (option) {
          return { commonName: option.label, scientificName: option.scientificName ?? null };
        }
      }
      return null;
    },
  );

  protected readonly canSave = computed(() => {
    const state = this.diagnosisState();
    return (
      !!this.selectedPlantId() && (state === 'success' || state === 'healthy') && this.hasPhotos()
    );
  });

  protected readonly primaryActionLabel = computed(() => {
    const state = this.diagnosisState();
    if (state === 'loading') return this.t.translate('leafDoctor.analyzingLabel');
    if (state === 'success' || state === 'healthy')
      return this.t.translate('leafDoctor.saveObservationLabel');
    return this.t.translate('leafDoctor.analyzeLabel');
  });

  protected readonly primaryActionIcon = computed(() => {
    const state = this.diagnosisState();
    return state === 'success' || state === 'healthy' ? 'pi pi-check' : 'pi pi-eye';
  });

  protected readonly primaryActionDisabled = computed(() => {
    if (this.isCompressing()) return true;
    const state = this.diagnosisState();
    if (state === 'loading') return true;
    if (state === 'success' || state === 'healthy') return !this.canSave();
    return !this.hasPhotos() || !this.selectedPlantId();
  });

  protected readonly primaryActionLoading = computed(
    () => this.diagnosisState() === 'loading' || this.saving(),
  );

  protected readonly primaryActionAriaLabel = computed(() => {
    const state = this.diagnosisState();
    if (state === 'loading') return this.t.translate('leafDoctor.analyzingAriaLabel');
    if (state === 'success') return this.t.translate('leafDoctor.saveDiagnosisAriaLabel');
    if (state === 'healthy') return this.t.translate('leafDoctor.saveHealthyAriaLabel');
    return this.t.translate('leafDoctor.analyzeAriaLabel');
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        const id = this.preselectedPlantId();
        if (id) this.selectedPlantId.set(id);
      }
    });

    effect(() => {
      const plants = this.plantService.plants();
      const names = [
        ...new Set(plants.map((p) => p.scientific_name).filter((n): n is string => n !== null)),
      ];
      if (names.length > 0) {
        void this._loadPlantThumbnails(names);
      }
    });
  }

  private async _loadPlantThumbnails(scientificNames: string[]): Promise<void> {
    const toFetch = scientificNames.filter(
      (n) => !untracked(() => this.plantThumbnailMap()).has(n),
    );
    if (toFetch.length === 0) return;
    const records = await this.libraryService.refetchByScientificNames(toFetch);
    this.plantThumbnailMap.update((map) => {
      const updated = new Map(map);
      for (const r of records) {
        updated.set(r.scientific_name, r.thumbnail_url ?? null);
      }
      for (const name of toFetch) {
        if (!updated.has(name)) updated.set(name, null);
      }
      return updated;
    });
  }

  private _blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  ngOnDestroy(): void {
    for (const url of this.previewObjectUrls()) {
      URL.revokeObjectURL(url);
    }
  }

  protected triggerPhotoInput(): void {
    this.photoInputRef()?.nativeElement.click();
  }

  async onFileChange(event: Event): Promise<void> {
    if (!this.canAddPhoto() || this.isCompressing()) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.diagnosisState.set('idle');
    this.diagnosisResult.set(null);
    this.speciesMismatchName.set(null);
    this.identifiedPlant.set(null);
    this.isCompressing.set(true);

    try {
      const blob = await this.compressor.compress(file);
      const url = URL.createObjectURL(blob);
      const label = `${Math.round(blob.size / 1024)} KB`;
      this.compressedBlobs.update((blobs) => [...blobs, blob]);
      this.previewObjectUrls.update((urls) => [...urls, url]);
      this.compressedLabels.update((labels) => [...labels, label]);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('leafDoctor.toast.imageError'),
        detail: this.t.translate('leafDoctor.toast.imageErrorDetail'),
      });
    } finally {
      this.isCompressing.set(false);
    }
  }

  protected removePhoto(index: number): void {
    const urls = this.previewObjectUrls();
    if (index >= 0 && index < urls.length) {
      URL.revokeObjectURL(urls[index]);
    }
    this.compressedBlobs.update((blobs) => blobs.filter((_, i) => i !== index));
    this.previewObjectUrls.update((urls) => urls.filter((_, i) => i !== index));
    this.compressedLabels.update((labels) => labels.filter((_, i) => i !== index));
    this.diagnosisState.set('idle');
    this.diagnosisResult.set(null);
    this.speciesMismatchName.set(null);
    this.identifiedPlant.set(null);
  }

  protected primaryAction(): void {
    const state = this.diagnosisState();
    if (state === 'success' || state === 'healthy') {
      void this.saveAsObservation();
    } else {
      void this.analyzePlant();
    }
  }

  async analyzePlant(): Promise<void> {
    const blobs = this.compressedBlobs();
    if (blobs.length === 0) return;

    const base64s = await Promise.all(blobs.map((b) => this._blobToBase64(b)));

    this.diagnosisState.set('loading');

    const plantContext = this.selectedPlantContext();
    const notes = this.symptomNotes().trim();

    const { data, error } = await this.supabase.client.functions.invoke<LeafDoctorResult>(
      'claude-vision',
      {
        body: {
          images: base64s.map((imageBase64) => ({ imageBase64, imageMediaType: 'image/jpeg' })),
          ...(plantContext ? { plantContext } : {}),
          ...(notes ? { userDescription: notes } : {}),
        },
      },
    );

    if (error || !data) {
      this.diagnosisState.set('error');
      return;
    }

    if (!data.is_botanical_image) {
      this.diagnosisState.set('not-botanical');
      return;
    }

    this.identifiedPlant.set(data.identified_plant ?? null);
    this.speciesMismatchName.set(
      data.species_matches_context === false ? (data.identified_plant ?? null) : null,
    );

    if (data.is_healthy) {
      this.diagnosisResult.set(null);
      this.diagnosisState.set('healthy');
    } else {
      this.diagnosisResult.set(data.diagnostics);
      this.diagnosisState.set('success');
    }
  }

  async saveAsObservation(): Promise<void> {
    const blobs = this.compressedBlobs();
    const plantId = this.selectedPlantId();
    const isHealthy = this.diagnosisState() === 'healthy';
    const result = this.diagnosisResult();

    if (blobs.length === 0 || !plantId) return;
    if (!isHealthy && !result) return;

    this.saving.set(true);

    try {
      const user = await this.supabase.getUser();
      if (!user) throw new Error('Not authenticated');

      const imagePath = await this.journalService.uploadImage(user.id, plantId, blobs[0]);

      const observation = this.symptomNotes().trim();
      let notes: string;
      let diagnosticsBlob: Json;

      if (isHealthy) {
        const healthyBlob: HealthyDiagnosticsBlob = {
          is_healthy: true,
          identified_plant: this.identifiedPlant(),
        };
        const aiSummary = 'Healthy — no issues found';
        notes = observation ? `${observation}\n\n${aiSummary}` : aiSummary;
        diagnosticsBlob = healthyBlob as unknown as Json;
      } else {
        const aiSummary = `Leaf Doctor: ${result!.primary_condition}\n${result!.immediate_remedial_actions.join('\n')}`;
        notes = observation ? `${observation}\n\n${aiSummary}` : aiSummary;
        const mismatch = this.speciesMismatchName();
        const diagBlob: LeafDoctorDiagnostics = mismatch
          ? { ...result!, species_mismatch_name: mismatch }
          : result!;
        diagnosticsBlob = diagBlob as unknown as Json;
      }

      await this.journalService.createEntry({
        plant_id: plantId,
        user_id: user.id,
        category: 'Observation',
        notes,
        image_storage_path: imagePath,
        diagnostics: diagnosticsBlob,
        logged_at: new Date().toISOString(),
      });

      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('leafDoctor.toast.saveSuccess'),
        detail: this.t.translate('leafDoctor.toast.saveSuccessDetail'),
      });

      this.entrySaved.emit();
      this.resetDialog();
      this.visible.set(false);
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('leafDoctor.toast.saveFailed'),
        detail: e instanceof Error ? e.message : 'Unexpected error.',
      });
    } finally {
      this.saving.set(false);
    }
  }

  onHide(): void {
    setTimeout(() => this._plantSelect()?.hide());
  }

  onCancel(): void {
    this.resetDialog();
    this.visible.set(false);
  }

  onVisibleChange(v: boolean): void {
    if (!v) {
      blurActiveElement();
      this.resetDialog();
    }
    this.visible.set(v);
  }

  private resetDialog(): void {
    for (const url of this.previewObjectUrls()) {
      URL.revokeObjectURL(url);
    }
    // In zone-detail mode the plant is locked — preserve the selection
    if (!this.preselectedPlantId()) {
      this.selectedPlantId.set(null);
    }
    this.compressedBlobs.set([]);
    this.previewObjectUrls.set([]);
    this.compressedLabels.set([]);
    this.diagnosisState.set('idle');
    this.diagnosisResult.set(null);
    this.speciesMismatchName.set(null);
    this.identifiedPlant.set(null);
    this.symptomNotes.set('');
    const photoEl = this.photoInputRef()?.nativeElement;
    if (photoEl) photoEl.value = '';
  }
}

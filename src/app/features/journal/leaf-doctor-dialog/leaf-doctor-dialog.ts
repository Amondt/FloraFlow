import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import {
  FloraDialogPT,
  FloraButtonPT,
  FloraMessagePT,
  FLORA_FOCUS,
} from '../../../shared/ui/pt/index';
import { PlantService } from '../../scheduler/plant.service';
import {
  JournalService,
  type LeafDoctorDiagnostics,
  type LeafDoctorResult,
} from '../journal.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { blurActiveElement } from '../../../shared/utils/dom';
import { PlantSelectComponent } from '../../../shared/components/plant-select/plant-select';
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
    PlantSelectComponent,
    LeafDoctorBadgesComponent,
  ],
  templateUrl: './leaf-doctor-dialog.html',
})
export class LeafDoctorDialogComponent implements OnDestroy {
  private readonly plantService = inject(PlantService);
  private readonly journalService = inject(JournalService);
  private readonly compressor = inject(ImageCompressorService);
  private readonly supabase = inject(SupabaseService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly preselectedPlantId = input<string | null>(null);
  readonly entrySaved = output<void>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FLORA_FOCUS = FLORA_FOCUS;

  protected readonly photoInputRef = viewChild<ElementRef<HTMLInputElement>>('photoInputRef');
  private readonly _plantSelect = viewChild<PlantSelectComponent>('plantSelectRef');

  readonly selectedPlantId = signal<string | null>(null);
  readonly compressedBlob = signal<Blob | null>(null);
  readonly previewObjectUrl = signal<string | null>(null);
  readonly compressedLabel = signal<string | null>(null);
  readonly diagnosisState = signal<'idle' | 'loading' | 'success' | 'error' | 'not-botanical'>(
    'idle',
  );
  readonly diagnosisResult = signal<LeafDoctorDiagnostics | null>(null);
  readonly saving = signal(false);

  protected readonly plantOptions = computed(() =>
    this.plantService.plants().map((p) => ({
      label: p.common_name,
      value: p.id,
      scientificName: p.scientific_name,
    })),
  );

  protected readonly canSave = computed(
    () =>
      !!this.selectedPlantId() && this.diagnosisState() === 'success' && !!this.compressedBlob(),
  );

  protected readonly primaryActionLabel = computed(() => {
    const state = this.diagnosisState();
    if (state === 'loading') return 'Analyzing…';
    if (state === 'success') return 'Save as Observation';
    return 'Analyze';
  });

  protected readonly primaryActionIcon = computed(() =>
    this.diagnosisState() === 'success' ? 'pi pi-check' : 'pi pi-eye',
  );

  protected readonly primaryActionDisabled = computed(() => {
    const state = this.diagnosisState();
    if (state === 'loading') return true;
    if (state === 'success') return !this.canSave();
    return !this.compressedBlob();
  });

  protected readonly primaryActionLoading = computed(
    () => this.diagnosisState() === 'loading' || this.saving(),
  );

  protected readonly primaryActionAriaLabel = computed(() => {
    const state = this.diagnosisState();
    if (state === 'loading') return 'Leaf Doctor is analyzing the photo, please wait';
    if (state === 'success') return 'Save Leaf Doctor diagnosis as a journal Observation entry';
    return 'Analyze this photo with Leaf Doctor AI';
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        const id = this.preselectedPlantId();
        if (id) this.selectedPlantId.set(id);
      }
    });
  }

  ngOnDestroy(): void {
    const url = this.previewObjectUrl();
    if (url) URL.revokeObjectURL(url);
  }

  protected triggerPhotoInput(): void {
    this.photoInputRef()?.nativeElement.click();
  }

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.compressedBlob.set(null);
    this.compressedLabel.set(null);
    const oldUrl = this.previewObjectUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.previewObjectUrl.set(null);
    this.diagnosisState.set('idle');
    this.diagnosisResult.set(null);

    try {
      const blob = await this.compressor.compress(file);
      this.compressedBlob.set(blob);
      this.compressedLabel.set(`${Math.round(blob.size / 1024)} KB`);
      this.previewObjectUrl.set(URL.createObjectURL(blob));
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Image error',
        detail: 'Could not process the selected image.',
      });
    }
  }

  protected primaryAction(): void {
    if (this.diagnosisState() === 'success') {
      void this.saveAsObservation();
    } else {
      void this.analyzePlant();
    }
  }

  async analyzePlant(): Promise<void> {
    const blob = this.compressedBlob();
    if (!blob) return;

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    this.diagnosisState.set('loading');

    const { data, error } = await this.supabase.client.functions.invoke<LeafDoctorResult>(
      'claude-vision',
      { body: { imageBase64: base64, imageMediaType: 'image/jpeg' } },
    );

    if (error || !data) {
      this.diagnosisState.set('error');
      return;
    }

    if (!data.is_botanical_image) {
      this.diagnosisState.set('not-botanical');
      return;
    }

    this.diagnosisResult.set(data.diagnostics);
    this.diagnosisState.set('success');
  }

  async saveAsObservation(): Promise<void> {
    const result = this.diagnosisResult();
    const blob = this.compressedBlob();
    const plantId = this.selectedPlantId();
    if (!result || !blob || !plantId) return;

    this.saving.set(true);

    try {
      const user = await this.supabase.getUser();
      if (!user) throw new Error('Not authenticated');

      const imagePath = await this.journalService.uploadImage(user.id, plantId, blob);
      const notes = `Leaf Doctor: ${result.primary_condition}\n${result.immediate_remedial_actions.join('\n')}`;

      await this.journalService.createEntry({
        plant_id: plantId,
        user_id: user.id,
        category: 'Observation',
        notes,
        image_storage_path: imagePath,
        diagnostics: result as unknown as Json,
        logged_at: new Date().toISOString(),
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Entry logged',
        detail: 'Leaf Doctor diagnosis saved as an Observation.',
      });

      this.entrySaved.emit();
      this.resetDialog();
      this.visible.set(false);
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: 'Failed to save',
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
    const oldUrl = this.previewObjectUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.selectedPlantId.set(null);
    this.compressedBlob.set(null);
    this.previewObjectUrl.set(null);
    this.compressedLabel.set(null);
    this.diagnosisState.set('idle');
    this.diagnosisResult.set(null);
    const photoEl = this.photoInputRef()?.nativeElement;
    if (photoEl) photoEl.value = '';
  }
}

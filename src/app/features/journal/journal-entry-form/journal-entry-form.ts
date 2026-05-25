import { Component, computed, inject, model, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import {
  FloraDialogPT,
  FloraSelectPT,
  FloraTextareaPT,
  FloraButtonPT,
  FLORA_ERROR,
} from '../../../shared/ui/pt/index';
import { PlantService } from '../../scheduler/plant.service';
import { JournalService } from '../journal.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import type { Database } from '../../../../types/database.types';

type LogCategory = Database['public']['Enums']['log_category_type'];

const CATEGORY_OPTIONS: { label: string; value: LogCategory }[] = [
  { label: 'Observation', value: 'Observation' },
  { label: 'Watering', value: 'Watering' },
  { label: 'Pruning', value: 'Pruning' },
  { label: 'Repotting', value: 'Repotting' },
  { label: 'Fertilization', value: 'Fertilization' },
  { label: 'Pest treatment', value: 'PestTreatment' },
];

@Component({
  selector: 'app-journal-entry-form',
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, SelectModule, TextareaModule, ButtonModule],
  templateUrl: './journal-entry-form.html',
})
export class JournalEntryFormComponent {
  private readonly plantService = inject(PlantService);
  private readonly journalService = inject(JournalService);
  private readonly compressor = inject(ImageCompressorService);
  private readonly supabase = inject(SupabaseService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraTextareaPT = FloraTextareaPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;
  protected readonly categoryOptions = CATEGORY_OPTIONS;

  protected readonly plantId = `flora-journal-plant-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly catId = `flora-journal-cat-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly notesId = `flora-journal-notes-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly photoId = `flora-journal-photo-${crypto.randomUUID().slice(0, 8)}`;

  protected readonly plantOptions = computed(() =>
    this.plantService.plants().map((p) => ({ label: p.common_name, value: p.id })),
  );

  readonly form = new FormGroup({
    plant_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl<string | null>(null, { validators: [Validators.maxLength(1000)] }),
  });

  readonly compressedBlob = signal<Blob | null>(null);
  readonly compressedLabel = signal<string | null>(null);
  readonly submitting = signal(false);

  get plantCtrl() {
    return this.form.controls.plant_id;
  }
  get categoryCtrl() {
    return this.form.controls.category;
  }
  get notesCtrl() {
    return this.form.controls.notes;
  }

  async onFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.compressedBlob.set(null);
    this.compressedLabel.set(null);

    try {
      const blob = await this.compressor.compress(file);
      this.compressedBlob.set(blob);
      this.compressedLabel.set(`${Math.round(blob.size / 1024)} KB`);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Image error',
        detail: 'Could not process the selected image.',
      });
    }
  }

  onVisibleChange(v: boolean): void {
    if (!v) this.resetForm();
    this.visible.set(v);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    try {
      const user = await this.supabase.getUser();
      if (!user) throw new Error('Not authenticated');

      const raw = this.form.getRawValue();
      const category = raw.category as LogCategory;
      const blob = this.compressedBlob();

      let imagePath: string | null = null;
      if (blob) {
        imagePath = await this.journalService.uploadImage(user.id, raw.plant_id, blob);
      }

      await this.journalService.createEntry({
        plant_id: raw.plant_id,
        category,
        notes: raw.notes ?? null,
        user_id: user.id,
        image_storage_path: imagePath,
        logged_at: new Date().toISOString(),
      });

      this.messageService.add({
        severity: 'success',
        summary: 'Entry logged',
        detail: 'Your care event has been recorded.',
      });

      this.onVisibleChange(false);
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: 'Failed to log entry',
        detail: e instanceof Error ? e.message : 'Unexpected error.',
      });
    } finally {
      this.submitting.set(false);
    }
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  private resetForm(): void {
    this.form.reset({ plant_id: '', category: '', notes: null });
    this.compressedBlob.set(null);
    this.compressedLabel.set(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}

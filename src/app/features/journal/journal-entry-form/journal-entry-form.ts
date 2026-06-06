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
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Select, SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import {
  FloraFormDialogPT,
  FloraSelectPT,
  FloraTextareaPT,
  FloraButtonPT,
  FloraInputTextPT,
  FLORA_ERROR,
  FLORA_FOCUS,
} from '../../../shared/ui/pt/index';
import { blurActiveElement } from '../../../shared/utils/dom';
import { PlantService } from '../../tasks/plant.service';
import { JournalService, type JournalEntryWithPlant } from '../journal.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CATEGORY_OPTIONS, type LogCategoryType } from '../journal-categories';

@Component({
  selector: 'app-journal-entry-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogModule,
    SelectModule,
    TextareaModule,
    ButtonModule,
    InputTextModule,
  ],
  templateUrl: './journal-entry-form.html',
})
export class JournalEntryFormComponent implements OnDestroy {
  private readonly plantService = inject(PlantService);
  private readonly journalService = inject(JournalService);
  private readonly compressor = inject(ImageCompressorService);
  private readonly supabase = inject(SupabaseService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly preselectedPlantId = input<string | null>(null);
  readonly editEntry = input<JournalEntryWithPlant | null>(null);
  readonly entrySaved = output<void>();

  protected readonly isEditMode = computed(() => this.editEntry() !== null);

  protected readonly FloraFormDialogPT = FloraFormDialogPT;
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraTextareaPT = FloraTextareaPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;
  protected readonly FLORA_FOCUS = FLORA_FOCUS;
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  protected readonly plantId = `flora-journal-plant-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly catId = `flora-journal-cat-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly notesId = `flora-journal-notes-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly dateId = `flora-journal-date-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly photoId = `flora-journal-photo-${crypto.randomUUID().slice(0, 8)}`;

  readonly photoInputRef = viewChild<ElementRef<HTMLInputElement>>('photoInputRef');
  private readonly _plantSelect = viewChild<Select>('plantSelectRef');
  private readonly _categorySelect = viewChild<Select>('categorySelectRef');

  protected readonly plantOptions = computed(() =>
    this.plantService.plants().map((p) => ({ label: p.common_name, value: p.id })),
  );

  readonly form = new FormGroup({
    plant_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    category: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    notes: new FormControl<string | null>(null, { validators: [Validators.maxLength(1000)] }),
    logged_at: new FormControl<string | null>(null),
  });

  readonly compressedBlob = signal<Blob | null>(null);
  readonly compressedLabel = signal<string | null>(null);
  readonly previewObjectUrl = signal<string | null>(null);
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

  constructor() {
    effect(() => {
      if (this.visible()) {
        const entry = this.editEntry();
        if (entry) {
          this.form.patchValue({
            plant_id: entry.plant_id,
            category: entry.category,
            notes: entry.notes ?? null,
            logged_at: new Date(entry.logged_at).toISOString().slice(0, 10),
          });
        } else {
          const id = this.preselectedPlantId();
          if (id) this.form.controls.plant_id.setValue(id);
        }
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

  onVisibleChange(v: boolean): void {
    if (!v) this.resetForm();
    this.visible.set(v);
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const isEditing = this.isEditMode();
    this.submitting.set(true);

    try {
      const raw = this.form.getRawValue();
      const category = raw.category as LogCategoryType;

      if (isEditing) {
        const entry = this.editEntry()!;
        await this.journalService.updateEntry(entry.id, {
          category,
          notes: raw.notes ?? null,
          logged_at: raw.logged_at
            ? new Date(raw.logged_at + 'T12:00:00').toISOString()
            : entry.logged_at,
        });

        this.messageService.add({
          severity: 'success',
          summary: 'Entry updated',
          detail: 'Your care event has been updated.',
        });
      } else {
        const user = await this.supabase.getUser();
        if (!user) throw new Error('Not authenticated');

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
          logged_at: raw.logged_at
            ? new Date(raw.logged_at + 'T12:00:00').toISOString()
            : new Date().toISOString(),
        });

        this.messageService.add({
          severity: 'success',
          summary: 'Entry logged',
          detail: 'Your care event has been recorded.',
        });
      }

      this.onVisibleChange(false);
      this.entrySaved.emit();
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: isEditing ? 'Failed to update entry' : 'Failed to log entry',
        detail: e instanceof Error ? e.message : 'Unexpected error.',
      });
    } finally {
      this.submitting.set(false);
    }
  }

  onHide(): void {
    setTimeout(() => {
      this._plantSelect()?.hide();
      this._categorySelect()?.hide();
    });
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  private resetForm(): void {
    this.form.reset({ plant_id: '', category: '', notes: null, logged_at: null });
    this.compressedBlob.set(null);
    this.compressedLabel.set(null);
    const oldUrl = this.previewObjectUrl();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    this.previewObjectUrl.set(null);
    const photoEl = this.photoInputRef()?.nativeElement;
    if (photoEl) photoEl.value = '';
    blurActiveElement();
  }
}

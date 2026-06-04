import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { AutoComplete, AutoCompleteModule, AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import {
  FloraDialogPT,
  FloraInputTextPT,
  FloraAutoCompletePT,
  FloraTextareaPT,
  FloraButtonPT,
  FLORA_ERROR,
} from '../../../shared/ui/pt/index';
import { blurActiveElement } from '../../../shared/utils/dom';
import {
  BotanicalSearchService,
  BotanicalSuggestion,
} from '../../../core/services/botanical-search.service';
import { SeedBatchService } from '../seed-batch.service';
import { SeedBatch, SeedBatchFormData } from '../seed-batch.model';

@Component({
  selector: 'app-seed-batch-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DialogModule,
    InputTextModule,
    AutoCompleteModule,
    TextareaModule,
    ButtonModule,
  ],
  templateUrl: './seed-batch-form-dialog.html',
})
export class SeedBatchFormDialogComponent {
  private readonly batchService = inject(SeedBatchService);
  private readonly messageService = inject(MessageService);
  private readonly botanicalSearch = inject(BotanicalSearchService);

  readonly visible = model<boolean>(false);
  readonly prefill = input<SeedBatchFormData | null>(null);
  readonly editTarget = input<SeedBatch | null>(null);
  readonly saved = output<SeedBatch>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraAutoCompletePT = FloraAutoCompletePT;
  protected readonly FloraTextareaPT = FloraTextareaPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;
  protected readonly currentYear = new Date().getFullYear();

  protected readonly commonNameId = `flora-batch-name-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly scientificNameId = `flora-batch-sci-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly brandId = `flora-batch-brand-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly packetYearId = `flora-batch-year-${crypto.randomUUID().slice(0, 8)}`;
  protected readonly notesId = `flora-batch-notes-${crypto.randomUUID().slice(0, 8)}`;

  protected readonly saving = signal(false);
  protected suggestions = signal<BotanicalSuggestion[]>([]);
  protected selectedPerenualId = signal<number | null>(null);
  protected lockedScientificName = signal<string | null>(null);
  protected commonNameQuery = '';

  private readonly _nameAC = viewChild<AutoComplete>('nameAC');

  readonly form = new FormGroup({
    common_name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    scientific_name: new FormControl<string | null>(null),
    brand: new FormControl<string | null>(null),
    packet_year: new FormControl<string | null>(null),
    notes: new FormControl<string | null>(null),
  });

  protected readonly dialogTitle = computed(() =>
    this.editTarget() ? 'Edit Batch' : 'New Seed Batch',
  );

  protected readonly submitLabel = computed(() =>
    this.editTarget() ? 'Save Changes' : 'Save Batch',
  );

  protected readonly submitAriaLabel = computed(() =>
    this.editTarget() ? 'Save changes to this seed batch' : 'Save new seed batch to the vault',
  );

  get nameCtrl() {
    return this.form.controls.common_name;
  }

  private _prevVisible = false;

  constructor() {
    effect(() => {
      const isVisible = this.visible();
      const justOpened = isVisible && !this._prevVisible;
      this._prevVisible = isVisible;

      if (!justOpened) return;

      this.selectedPerenualId.set(null);
      this.lockedScientificName.set(null);

      const target = this.editTarget();
      if (target) {
        this.commonNameQuery = target.common_name;
        this.form.reset({
          common_name: target.common_name,
          scientific_name: target.scientific_name,
          brand: target.brand,
          packet_year: target.packet_year?.toString() ?? null,
          notes: target.notes,
        });
      } else {
        const pre = this.prefill();
        this.commonNameQuery = pre?.common_name ?? '';
        this.form.reset({
          common_name: pre?.common_name ?? '',
          scientific_name: pre?.scientific_name ?? null,
          brand: pre?.brand ?? null,
          packet_year: pre?.packet_year?.toString() ?? null,
          notes: pre?.notes ?? null,
        });
      }
    });
  }

  onHide(): void {
    this._nameAC()?.hide();
  }

  onVisibleChange(v: boolean): void {
    if (!v) blurActiveElement();
    this.visible.set(v);
  }

  onCancel(): void {
    blurActiveElement();
    this.visible.set(false);
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

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    const rawYear = this.form.controls.packet_year.value;
    const parsedYear = rawYear ? Number(rawYear) : null;
    const packetYear = parsedYear !== null && !isNaN(parsedYear) ? parsedYear : null;

    const formData: SeedBatchFormData = {
      common_name: this.form.controls.common_name.value,
      scientific_name: this.form.controls.scientific_name.value || null,
      brand: this.form.controls.brand.value || null,
      packet_year: packetYear,
      notes: this.form.controls.notes.value || null,
    };

    try {
      const target = this.editTarget();
      if (target) {
        await this.batchService.updateBatch(target.id, formData);
        if (this.batchService.error()) throw new Error(this.batchService.error()!);
        const updated =
          this.batchService.batches().find((b) => b.id === target.id) ??
          ({ ...target, ...formData } as SeedBatch);
        this.saved.emit(updated);
      } else {
        const created = await this.batchService.createBatch(formData);
        if (!created) throw new Error(this.batchService.error() ?? 'Failed to create batch.');
        this.saved.emit(created);
      }
      blurActiveElement();
      this.visible.set(false);
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: this.editTarget() ? 'Update failed' : 'Save failed',
        detail: e instanceof Error ? e.message : 'Unexpected error.',
      });
    } finally {
      this.saving.set(false);
    }
  }
}

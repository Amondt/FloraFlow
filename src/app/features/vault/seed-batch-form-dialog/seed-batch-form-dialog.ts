import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import {
  FloraDialogPT,
  FloraInputTextPT,
  FloraTextareaPT,
  FloraButtonPT,
  FLORA_ERROR,
} from '../../../shared/ui/pt/index';
import { blurActiveElement } from '../../../shared/utils/dom';
import { SeedBatchService } from '../seed-batch.service';
import { SeedBatch, SeedBatchFormData } from '../seed-batch.model';

@Component({
  selector: 'app-seed-batch-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, DialogModule, InputTextModule, TextareaModule, ButtonModule],
  templateUrl: './seed-batch-form-dialog.html',
})
export class SeedBatchFormDialogComponent {
  private readonly batchService = inject(SeedBatchService);
  private readonly messageService = inject(MessageService);

  readonly visible = model<boolean>(false);
  readonly prefill = input<SeedBatchFormData | null>(null);
  readonly editTarget = input<SeedBatch | null>(null);
  readonly saved = output<SeedBatch>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
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

      const target = this.editTarget();
      if (target) {
        this.form.reset({
          common_name: target.common_name,
          scientific_name: target.scientific_name,
          brand: target.brand,
          packet_year: target.packet_year?.toString() ?? null,
          notes: target.notes,
        });
      } else {
        const pre = this.prefill();
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

  onVisibleChange(v: boolean): void {
    if (!v) blurActiveElement();
    this.visible.set(v);
  }

  onCancel(): void {
    blurActiveElement();
    this.visible.set(false);
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

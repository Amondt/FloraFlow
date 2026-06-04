import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { Message } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SeedBatchService } from './seed-batch.service';
import { SeedBatchCardComponent } from './seed-batch-card/seed-batch-card';
import { SeedBatch, SeedBatchFormData, SeedStage, SEED_STAGE_OPTIONS } from './seed-batch.model';
import { SeedBatchFormDialogComponent } from './seed-batch-form-dialog/seed-batch-form-dialog';
import {
  FloraButtonPT,
  FloraConfirmDialogPT,
  FloraMessagePT,
  FloraSkeletonPT,
  FloraToastPT,
} from '../../shared/ui/pt/index';
import { tabClass, tabCountClass } from '../../shared/utils/tab-styles.util';

@Component({
  selector: 'app-vault',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ConfirmDialogModule,
    ToastModule,
    Message,
    SeedBatchCardComponent,
    SeedBatchFormDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './vault.html',
})
export class VaultComponent implements OnInit {
  protected readonly batchService = inject(SeedBatchService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3];
  protected readonly stageFilters: (SeedStage | 'All')[] = ['All', ...SEED_STAGE_OPTIONS];

  protected readonly selectedStageFilter = signal<SeedStage | 'All'>('All');
  protected readonly formDialogVisible = signal(false);
  protected readonly editTarget = signal<SeedBatch | null>(null);
  protected readonly prefillData = signal<SeedBatchFormData | null>(null);

  protected readonly filteredBatches = computed(() => {
    const filter = this.selectedStageFilter();
    if (filter === 'All') return this.batchService.batches();
    return this.batchService.batches().filter((b) => b.current_stage === filter);
  });

  protected readonly activeCount = computed(
    () => this.batchService.batches().filter((b) => b.current_stage !== 'Stored').length,
  );

  protected readonly totalCount = computed(() => this.batchService.batches().length);

  ngOnInit(): void {
    void this.batchService.loadBatches();
  }

  protected getStageTabClass(stage: SeedStage | 'All'): string {
    return tabClass(this.selectedStageFilter() === stage);
  }

  protected getStageTabCountClass(stage: SeedStage | 'All'): string {
    return tabCountClass(this.selectedStageFilter() === stage);
  }

  protected getBatchCount(stage: SeedStage | 'All'): number {
    if (stage === 'All') return this.batchService.batches().length;
    return this.batchService.batches().filter((b) => b.current_stage === stage).length;
  }

  protected nextStageName(batch: SeedBatch): string {
    const idx = SEED_STAGE_OPTIONS.indexOf(batch.current_stage);
    if (idx === -1 || idx === SEED_STAGE_OPTIONS.length - 1) return '';
    return SEED_STAGE_OPTIONS[idx + 1];
  }

  protected confirmAdvance(batch: SeedBatch): void {
    const nextStage = this.nextStageName(batch);
    this.confirmService.confirm({
      message: `Advance '${batch.common_name}' to ${nextStage}? This cannot be undone.`,
      header: 'Advance stage',
      acceptLabel: 'Advance',
      rejectLabel: 'Cancel',
      accept: () => void this._doAdvance(batch, nextStage),
    });
  }

  protected confirmDelete(batch: SeedBatch): void {
    this.confirmService.confirm({
      message: `Delete '${batch.common_name}'? This cannot be undone.`,
      header: 'Delete batch',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => void this._doDelete(batch),
    });
  }

  protected openCreateDialog(prefill?: SeedBatchFormData): void {
    this.editTarget.set(null);
    this.prefillData.set(prefill ?? null);
    this.formDialogVisible.set(true);
  }

  protected openEditDialog(batch: SeedBatch): void {
    this.editTarget.set(batch);
    this.prefillData.set(null);
    this.formDialogVisible.set(true);
  }

  protected onFormSaved(batch: SeedBatch): void {
    const isEdit = this.editTarget() !== null;
    this.messageService.add({
      severity: 'success',
      summary: isEdit ? 'Batch updated' : 'Batch saved',
      detail: isEdit
        ? `'${batch.common_name}' has been updated.`
        : `'${batch.common_name}' added to the vault.`,
    });
  }

  protected onGraduateRequested(_batch: SeedBatch): void {
    // Graduate to Plant wiring — Phase 3.5
  }

  private async _doAdvance(batch: SeedBatch, nextStage: string): Promise<void> {
    await this.batchService.advanceStage(batch);
    if (this.batchService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Advance failed',
        detail: this.batchService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: 'Stage advanced',
        detail: `'${batch.common_name}' is now ${nextStage}.`,
      });
    }
  }

  private async _doDelete(batch: SeedBatch): Promise<void> {
    await this.batchService.deleteBatch(batch.id);
    if (this.batchService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Delete failed',
        detail: this.batchService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: 'Batch deleted',
        detail: `'${batch.common_name}' has been removed.`,
      });
    }
  }
}

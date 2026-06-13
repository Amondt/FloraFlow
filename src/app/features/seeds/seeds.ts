import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../core/services/locale.service';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { Message } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SeedBatchService } from './seed-batch.service';
import { SeedBatchCardComponent } from './seed-batch-card/seed-batch-card';
import {
  SeedBatch,
  SeedBatchFormData,
  SeedStage,
  SEED_STAGE_OPTIONS,
  SEED_STAGE_LABEL_KEYS,
} from './seed-batch.model';
import { SeedBatchFormDialogComponent } from './seed-batch-form-dialog/seed-batch-form-dialog';
import { PlantFormDialogComponent } from '../tasks/plant-form-dialog/plant-form-dialog';
import { PlantFormData } from '../tasks/plant.model';
import { PlantService } from '../tasks/plant.service';
import {
  FloraButtonPT,
  FloraConfirmDialogPT,
  FloraMessagePT,
  FloraSkeletonPT,
  FloraToastPT,
} from '../../shared/ui/pt/index';
import { tabClass, tabCountClass } from '../../shared/utils/tab-styles.util';
import { PendingDeleteManager } from '../../shared/utils/pending-delete';

@Component({
  selector: 'app-seeds',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ConfirmDialogModule,
    ToastModule,
    Message,
    TranslocoPipe,
    SeedBatchCardComponent,
    SeedBatchFormDialogComponent,
    PlantFormDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './seeds.html',
})
export class SeedsComponent implements OnInit {
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  protected readonly batchService = inject(SeedBatchService);
  private readonly plantService = inject(PlantService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly _deleteManager = new PendingDeleteManager();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3];
  protected readonly stageFilters: (SeedStage | 'All' | 'Archived')[] = [
    'All',
    ...SEED_STAGE_OPTIONS,
    'Archived',
  ];

  protected readonly selectedStageFilter = signal<SeedStage | 'All' | 'Archived'>('All');
  protected readonly formDialogVisible = signal(false);
  protected readonly editTarget = signal<SeedBatch | null>(null);
  protected readonly prefillData = signal<SeedBatchFormData | null>(null);

  protected readonly plantFormVisible = signal(false);
  protected readonly graduatePrefill = signal<{
    common_name: string;
    scientific_name: string | null;
    inat_taxon_id: number | null;
  } | null>(null);

  protected readonly selectedStageLabel = computed(() => {
    const _lang = this.localeService.locale();
    return this.t.translate(SEED_STAGE_LABEL_KEYS[this.selectedStageFilter()]);
  });

  protected stageKey(stage: SeedStage | 'All' | 'Archived'): string {
    return SEED_STAGE_LABEL_KEYS[stage];
  }

  protected readonly filteredBatches = computed(() => {
    const filter = this.selectedStageFilter();
    if (filter === 'All') return this.batchService.batches();
    if (filter === 'Archived') return this.batchService.archivedBatches();
    return this.batchService.batches().filter((b) => b.current_stage === filter);
  });

  protected readonly activeCount = computed(
    () => this.batchService.batches().filter((b) => b.current_stage !== 'Stored').length,
  );

  protected readonly totalCount = computed(() => this.batchService.batches().length);

  constructor() {
    effect(() => {
      if (this.selectedStageFilter() === 'Archived') {
        void this.batchService.loadArchivedBatches();
      }
    });

    this.destroyRef.onDestroy(() => {
      this._deleteManager.flushAll((id) => this.batchService.deleteBatch(id));
    });
  }

  ngOnInit(): void {
    void this.batchService.loadBatches();
    void this.batchService.loadArchivedBatches();

    const params = this.route.snapshot.queryParamMap;
    const name = params.get('name');
    if (name) {
      const scientific = params.get('scientific');
      this.openCreateDialog({
        common_name: name,
        scientific_name: scientific ?? null,
        brand: null,
        packet_year: null,
        notes: null,
      });
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected getStageTabClass(stage: SeedStage | 'All' | 'Archived'): string {
    return tabClass(this.selectedStageFilter() === stage);
  }

  protected getStageTabCountClass(stage: SeedStage | 'All' | 'Archived'): string {
    return tabCountClass(this.selectedStageFilter() === stage);
  }

  protected getBatchCount(stage: SeedStage | 'All' | 'Archived'): number {
    if (stage === 'All') return this.batchService.batches().length;
    if (stage === 'Archived') return this.batchService.archivedBatches().length;
    return this.batchService.batches().filter((b) => b.current_stage === stage).length;
  }

  protected nextStageName(batch: SeedBatch): string {
    const idx = SEED_STAGE_OPTIONS.indexOf(batch.current_stage);
    if (idx === -1 || idx === SEED_STAGE_OPTIONS.length - 1) return '';
    return SEED_STAGE_OPTIONS[idx + 1];
  }

  protected confirmAdvance(batch: SeedBatch): void {
    const nextStage = this.nextStageName(batch);
    const nextStageLabel = this.t.translate(
      SEED_STAGE_LABEL_KEYS[nextStage as SeedStage] ?? nextStage,
    );
    this.confirmService.confirm({
      message: this.t.translate('seeds.toast.advanceMessage', {
        name: batch.common_name,
        stage: nextStageLabel,
      }),
      header: this.t.translate('seeds.toast.advanceHeader'),
      acceptLabel: this.t.translate('seeds.toast.advanceAccept'),
      rejectLabel: this.t.translate('common.cancel'),
      accept: () => void this._doAdvance(batch, nextStage),
    });
  }

  protected confirmArchive(batch: SeedBatch): void {
    this.confirmService.confirm({
      message: this.t.translate('seeds.toast.archiveMessage', { name: batch.common_name }),
      header: this.t.translate('seeds.toast.archiveHeader'),
      acceptLabel: this.t.translate('seeds.toast.archiveAccept'),
      rejectLabel: this.t.translate('common.cancel'),
      accept: () => void this._doArchive(batch),
    });
  }

  protected onDeleteRequested(batch: SeedBatch): void {
    this.confirmService.confirm({
      message: this.t.translate('seeds.toast.deleteMessage', { name: batch.common_name }),
      header: this.t.translate('seeds.toast.deleteHeader'),
      acceptLabel: this.t.translate('common.delete'),
      rejectLabel: this.t.translate('common.cancel'),
      accept: () => {
        this.batchService.optimisticallyRemoveBatch(batch);
        this.messageService.add({
          severity: 'warn',
          summary: this.t.translate('seeds.toast.deletedSummary'),
          detail: this.t.translate('seeds.toast.deletedDetail', { name: batch.common_name }),
          life: 5000,
          data: { canUndo: true, batch },
        });
        this._deleteManager.schedule(batch.id, 5000, async () => {
          await this.batchService.deleteBatch(batch.id);
          if (this.batchService.error()) {
            this.batchService.restoreBatch(batch);
            this.messageService.add({
              severity: 'error',
              summary: this.t.translate('seeds.toast.deleteFailed'),
              detail: this.batchService.error()!,
            });
          }
        });
      },
      reject: () => {},
    });
  }

  protected undoDelete(batch: SeedBatch): void {
    this._deleteManager.undo(batch.id);
    this.batchService.restoreBatch(batch);
    this.messageService.clear();
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
      summary: isEdit
        ? this.t.translate('seeds.toast.updatedSummary')
        : this.t.translate('seeds.toast.savedSummary'),
      detail: isEdit
        ? this.t.translate('seeds.toast.updatedDetail', { name: batch.common_name })
        : this.t.translate('seeds.toast.savedDetail', { name: batch.common_name }),
    });
  }

  protected onGraduateRequested(batch: SeedBatch): void {
    this.graduatePrefill.set({
      common_name: batch.common_name,
      scientific_name: batch.scientific_name,
      inat_taxon_id: null,
    });
    this.plantFormVisible.set(true);
  }

  protected async onPlantSaved(data: PlantFormData): Promise<void> {
    this.plantFormVisible.set(false);
    const newPlant = await this.plantService.createPlant(data);
    if (this.plantService.error() || !newPlant) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('seeds.toast.plantAddFailed'),
        detail: this.plantService.error() ?? this.t.translate('seeds.toast.unexpectedError'),
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('seeds.toast.plantAdded'),
        detail: this.t.translate('seeds.toast.plantAddedDetail', { name: data.common_name }),
      });
    }
  }

  private async _doAdvance(batch: SeedBatch, nextStage: string): Promise<void> {
    await this.batchService.advanceStage(batch);
    if (this.batchService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('seeds.toast.advanceFailed'),
        detail: this.batchService.error()!,
      });
    } else {
      const nextStageLabel = this.t.translate(
        SEED_STAGE_LABEL_KEYS[nextStage as SeedStage] ?? nextStage,
      );
      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('seeds.toast.advanceSuccess'),
        detail:
          nextStage === 'Transplanted Outside'
            ? this.t.translate('seeds.toast.advanceTransplanted', { name: batch.common_name })
            : this.t.translate('seeds.toast.advanceTo', {
                name: batch.common_name,
                stage: nextStageLabel,
              }),
      });
    }
  }

  private async _doArchive(batch: SeedBatch): Promise<void> {
    await this.batchService.archiveBatch(batch.id);
    if (this.batchService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('seeds.toast.archiveFailed'),
        detail: this.batchService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('seeds.toast.archiveSuccess'),
        detail: this.t.translate('seeds.toast.archiveDetail', { name: batch.common_name }),
      });
    }
  }
}

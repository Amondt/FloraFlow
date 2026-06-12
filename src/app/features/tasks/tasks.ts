import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PlantAlertCardComponent } from './plant-alert-card/plant-alert-card';
import { SoilCheckDialogComponent } from './soil-check-dialog/soil-check-dialog';
import { PlantFormDialogComponent } from './plant-form-dialog/plant-form-dialog';
import { PlantService } from './plant.service';
import { Plant, PlantFormData } from './plant.model';
import { JournalService } from '../journal/journal.service';
import { plantAddedDetail } from '../../shared/utils/plant-message.util';
import { PendingDeleteManager } from '../../shared/utils/pending-delete';
import { ZoneService } from '../dashboard/zone.service';
import { BotanicalThumbnailService } from '../../core/services/botanical-thumbnail.service';
import {
  FloraButtonPT,
  FloraConfirmDialogPT,
  FloraMessagePT,
  FloraSkeletonPT,
  FloraToastPT,
} from '../../shared/ui/pt/index';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    RouterLink,
    Message,
    SkeletonModule,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    TranslocoPipe,
    PlantAlertCardComponent,
    SoilCheckDialogComponent,
    PlantFormDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './tasks.html',
})
export class TasksComponent {
  protected readonly plantService = inject(PlantService);
  protected readonly zoneService = inject(ZoneService);
  protected readonly thumbnailService = inject(BotanicalThumbnailService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly journalService = inject(JournalService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = inject(TranslocoService);
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3];

  readonly zoneMap = this.zoneService.zoneMap;

  protected readonly hasZones = computed(() => this.zoneService.zones().length > 0);

  readonly attentionCount = computed(() => {
    const g = this.plantsGrouped();
    return g.overdue.length + g.today.length;
  });

  readonly soonCount = computed(() => this.plantsGrouped().soon.length);

  readonly plant = input<string | undefined>(undefined);

  readonly selectedPlant = signal<Plant | null>(null);
  readonly dialogVisible = signal(false);
  readonly plantFormVisible = signal(false);
  readonly plantFormTarget = signal<Plant | null>(null);
  private readonly _deleteManager = new PendingDeleteManager();
  // Public alias so existing tests can still call component.pendingDeleteIds.set(...)
  readonly pendingDeleteIds = this._deleteManager.pendingIds;
  readonly plantsGrouped = computed(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() + 1,
    );
    const endOfWeek = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() + 8,
    );

    type Groups = { overdue: Plant[]; today: Plant[]; soon: Plant[]; upcoming: Plant[] };
    const active = this.plantService.plants().filter((p) => !this.pendingDeleteIds().has(p.id));
    return active.reduce<Groups>(
      (acc, p) => {
        const due = new Date(p.next_check_due_at);
        if (due < startOfToday) acc.overdue.push(p);
        else if (due < startOfTomorrow) acc.today.push(p);
        else if (due < endOfWeek) acc.soon.push(p);
        else acc.upcoming.push(p);
        return acc;
      },
      { overdue: [], today: [], soon: [], upcoming: [] },
    );
  });

  private _autoOpenedPlantId: string | null = null;

  constructor() {
    if (this.plantService.plants().length === 0) {
      void this.plantService.loadPlants();
    }
    if (this.zoneService.zones().length === 0) {
      void this.zoneService.loadZones();
    }

    effect(() => {
      const plants = this.plantService.plants();
      if (plants.length > 0) void this.thumbnailService.loadFor(plants);
    });

    effect(() => {
      if (!this.dialogVisible()) {
        this.selectedPlant.set(null);
      }
    });

    effect(() => {
      const id = this.plant();
      if (!id) return;
      if (this.plantService.loading()) return;
      const plants = this.plantService.plants();
      if (this._autoOpenedPlantId === id) return;
      const plant = plants.find((p) => p.id === id);
      if (!plant) return;
      this._autoOpenedPlantId = id;
      this.onCheckNow(plant);
    });

    this.destroyRef.onDestroy(() => {
      this._deleteManager.flushAll((id) => this.plantService.deletePlant(id));
    });
  }

  onCheckNow(plant: Plant): void {
    this.selectedPlant.set(plant);
    this.dialogVisible.set(true);
  }

  async onConfirmed(payload: { plant: Plant; note: string; days: number }): Promise<void> {
    await this.plantService.confirmCheck(payload.plant.id, payload.days);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('tasks.toast.checkFailed'),
        detail: this.plantService.error()!,
      });
      return;
    }
    try {
      await this.journalService.logWatering(payload.plant.id, payload.note);
    } catch {
      // journal write is non-critical — plant check is already confirmed
    }
    this.messageService.add({
      severity: 'success',
      summary: this.t.translate('tasks.toast.wateringLogged'),
      detail: this.t.translate('tasks.toast.wateringLoggedDetail', {
        name: payload.plant.common_name,
      }),
    });
  }

  async onSnoozed(payload: { id: string; days: number }): Promise<void> {
    await this.plantService.snoozeCheck(payload.id, payload.days);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('tasks.toast.snoozeFailed'),
        detail: this.plantService.error()!,
      });
    } else {
      const plant = this.plantService.plants().find((p) => p.id === payload.id);
      const name = plant?.common_name ?? 'Plant';
      this.messageService.add({
        severity: 'info',
        summary: this.t.translate('tasks.toast.checkSnoozed'),
        detail: this.t.translate('tasks.toast.checkSnoozedDetail', { name }),
      });
    }
  }

  openAddPlant(): void {
    this.plantFormTarget.set(null);
    this.plantFormVisible.set(true);
  }

  openEditPlant(plant: Plant): void {
    this.plantFormTarget.set(plant);
    this.plantFormVisible.set(true);
  }

  onDeleteRequested(plant: Plant): void {
    this.confirmService.confirm({
      message: this.t.translate('tasks.toast.deleteMessage', { name: plant.common_name }),
      header: this.t.translate('tasks.toast.deleteHeader'),
      acceptLabel: this.t.translate('common.delete'),
      rejectLabel: this.t.translate('common.cancel'),
      accept: () => {
        this.messageService.add({
          severity: 'warn',
          summary: this.t.translate('tasks.toast.plantDeleted'),
          detail: this.t.translate('tasks.toast.plantDeletedDetail', { name: plant.common_name }),
          life: 5000,
          data: { canUndo: true, id: plant.id },
        });
        this._deleteManager.schedule(plant.id, 5000, async () => {
          await this.plantService.deletePlant(plant.id);
          if (this.plantService.error()) {
            this.messageService.add({
              severity: 'error',
              summary: this.t.translate('tasks.toast.deleteFailed'),
              detail: this.plantService.error()!,
            });
          }
        });
      },
      reject: () => {},
    });
  }

  undoDelete(id: string): void {
    this._deleteManager.undo(id);
    this.messageService.clear();
  }

  async onPlantSaved(data: PlantFormData): Promise<void> {
    const target = this.plantFormTarget();
    if (target) {
      await this.plantService.updatePlant(target.id, data);
      if (this.plantService.error()) {
        this.messageService.add({
          severity: 'error',
          summary: this.t.translate('tasks.toast.updateFailed'),
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: this.t.translate('tasks.toast.plantUpdated'),
          detail: this.t.translate('tasks.toast.plantUpdatedDetail', { name: data.common_name }),
        });
      }
    } else {
      const newPlant = await this.plantService.createPlant(data);
      if (this.plantService.error() || !newPlant) {
        this.messageService.add({
          severity: 'error',
          summary: this.t.translate('tasks.toast.addFailed'),
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: this.t.translate('tasks.toast.plantAdded'),
          detail: plantAddedDetail(data.common_name, newPlant.next_check_due_at),
        });
      }
    }
  }
}

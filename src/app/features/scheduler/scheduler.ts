import { Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
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
  selector: 'app-scheduler',
  standalone: true,
  imports: [
    RouterLink,
    Message,
    SkeletonModule,
    ButtonModule,
    ConfirmDialogModule,
    ToastModule,
    PlantAlertCardComponent,
    SoilCheckDialogComponent,
    PlantFormDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './scheduler.html',
})
export class SchedulerComponent {
  protected readonly plantService = inject(PlantService);
  protected readonly zoneService = inject(ZoneService);
  protected readonly thumbnailService = inject(BotanicalThumbnailService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly journalService = inject(JournalService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3];

  readonly zoneMap = computed(() => new Map(this.zoneService.zones().map((z) => [z.id, z])));

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

    const active = this.plantService.plants().filter((p) => !this.pendingDeleteIds().has(p.id));

    return {
      overdue: active.filter((p) => new Date(p.next_check_due_at) < startOfToday),
      today: active.filter((p) => {
        const due = new Date(p.next_check_due_at);
        return due >= startOfToday && due < startOfTomorrow;
      }),
      soon: active.filter((p) => {
        const due = new Date(p.next_check_due_at);
        return due >= startOfTomorrow && due < endOfWeek;
      }),
      upcoming: active.filter((p) => new Date(p.next_check_due_at) >= endOfWeek),
    };
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
        summary: 'Check failed',
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
      summary: 'Watering logged',
      detail: `Watering for "${payload.plant.common_name}" added to your journal.`,
    });
  }

  async onSnoozed(payload: { id: string; days: number }): Promise<void> {
    await this.plantService.snoozeCheck(payload.id, payload.days);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Snooze failed',
        detail: this.plantService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'info',
        summary: 'Check snoozed',
        detail: 'Next check rescheduled based on container and substrate.',
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
      message: `Remove "${plant.common_name}"? You can undo this.`,
      header: 'Delete plant',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Plant deleted',
          detail: `"${plant.common_name}" removed. Tap Undo to cancel.`,
          life: 5000,
          data: { canUndo: true, id: plant.id },
        });
        this._deleteManager.schedule(plant.id, 5000, async () => {
          await this.plantService.deletePlant(plant.id);
          if (this.plantService.error()) {
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
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
          summary: 'Update failed',
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Plant updated',
          detail: `"${data.common_name}" has been saved.`,
        });
      }
    } else {
      const newPlant = await this.plantService.createPlant(data);
      if (this.plantService.error() || !newPlant) {
        this.messageService.add({
          severity: 'error',
          summary: 'Add failed',
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Plant added',
          detail: plantAddedDetail(data.common_name, newPlant.next_check_due_at),
        });
      }
    }
  }
}

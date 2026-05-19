import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PlantAlertCardComponent } from './plant-alert-card';
import { SoilCheckDialogComponent } from './soil-check-dialog';
import { PlantFormDialogComponent } from './plant-form-dialog';
import { PlantService } from './plant.service';
import { Plant, PlantFormData } from './plant.model';
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
  private readonly confirmService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private  readonly destroyRef    = inject(DestroyRef);
  protected readonly FloraButtonPT        = FloraButtonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraMessagePT       = FloraMessagePT;
  protected readonly FloraSkeletonPT      = FloraSkeletonPT;
  protected readonly FloraToastPT         = FloraToastPT;
  protected readonly loadingPlaceholders  = [1, 2, 3];

  readonly selectedPlant    = signal<Plant | null>(null);
  readonly dialogVisible    = signal(false);
  readonly plantFormVisible = signal(false);
  readonly plantFormTarget  = signal<Plant | null>(null);
  readonly plantToDelete    = signal<Plant | null>(null);

  readonly pendingDeleteIds = signal<Set<string>>(new Set());
  readonly plantsGrouped = computed(() => {
    const now = new Date();
    const startOfToday    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + 1);
    const startOfDay8     = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), startOfToday.getDate() + 8);

    const active = this.plantService.plants().filter(p => !this.pendingDeleteIds().has(p.id));

    return {
      overdue:  active.filter(p => new Date(p.next_check_due_at) < startOfToday),
      today:    active.filter(p => {
        const due = new Date(p.next_check_due_at);
        return due >= startOfToday && due < startOfTomorrow;
      }),
      soon:     active.filter(p => {
        const due = new Date(p.next_check_due_at);
        return due >= startOfTomorrow && due < startOfDay8;
      }),
      upcoming: active.filter(p => new Date(p.next_check_due_at) >= startOfDay8),
    };
  });

  private readonly _deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    if (this.plantService.plants().length === 0) {
      void this.plantService.loadPlants();
    }

    effect(() => {
      if (!this.dialogVisible()) {
        this.selectedPlant.set(null);
      }
    });

    this.destroyRef.onDestroy(() => {
      this._deleteTimers.forEach(clearTimeout);
      this._deleteTimers.clear();
    });
  }

  onCheckNow(plant: Plant): void {
    this.selectedPlant.set(plant);
    this.dialogVisible.set(true);
  }

  onSnoozeFromCard(plantId: string): void {
    void this.plantService.snoozeCheck(plantId);
  }

  async onConfirmed(plant: Plant): Promise<void> {
    await this.plantService.confirmCheck(plant.id);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check failed',
        detail: this.plantService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: 'Check logged',
        detail: `Soil check for "${plant.common_name}" recorded.`,
      });
    }
  }

  async onSnoozed(plantId: string): Promise<void> {
    await this.plantService.snoozeCheck(plantId);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Snooze failed',
        detail: this.plantService.error()!,
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
    this.plantToDelete.set(plant);
    this.plantFormVisible.set(false);
    this.confirmService.confirm({
      message: `Remove "${plant.common_name}"? You can undo this.`,
      header: 'Delete plant',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.pendingDeleteIds.update(ids => new Set([...ids, plant.id]));
        this.plantToDelete.set(null);
        this.messageService.add({
          severity: 'warn',
          summary: 'Plant deleted',
          detail: `"${plant.common_name}" removed. Tap Undo to cancel.`,
          life: 5000,
          data: { canUndo: true, id: plant.id },
        });
        const timer = setTimeout(async () => {
          this._deleteTimers.delete(plant.id);
          this.pendingDeleteIds.update(ids => {
            const next = new Set(ids);
            next.delete(plant.id);
            return next;
          });
          await this.plantService.deletePlant(plant.id);
          if (this.plantService.error()) {
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: this.plantService.error()!,
            });
          }
        }, 5000);
        this._deleteTimers.set(plant.id, timer);
      },
      reject: () => {
        this.plantToDelete.set(null);
      },
    });
  }

  undoDelete(id: string): void {
    const timer = this._deleteTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._deleteTimers.delete(id);
    }
    this.pendingDeleteIds.update(ids => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
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
      await this.plantService.createPlant(data);
      if (this.plantService.error()) {
        this.messageService.add({
          severity: 'error',
          summary: 'Add failed',
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Plant added',
          detail: `"${data.common_name}" added to your greenhouse.`,
        });
      }
    }
  }
}

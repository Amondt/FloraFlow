import { Component, effect, inject, signal } from '@angular/core';
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
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3];

  readonly selectedPlant = signal<Plant | null>(null);
  readonly dialogVisible = signal(false);
  readonly plantFormVisible = signal(false);
  readonly plantFormTarget = signal<Plant | null>(null);
  readonly plantToDelete = signal<Plant | null>(null);

  constructor() {
    if (this.plantService.duePlants().length === 0) {
      void this.plantService.loadDuePlants();
    }

    effect(() => {
      if (!this.dialogVisible()) {
        this.selectedPlant.set(null);
      }
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
      message: `Delete "${plant.common_name}"? This cannot be undone.`,
      header: 'Delete plant',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: async () => {
        await this.plantService.deletePlant(plant.id);
        this.plantToDelete.set(null);
        if (this.plantService.error()) {
          this.messageService.add({
            severity: 'error',
            summary: 'Delete failed',
            detail: this.plantService.error()!,
          });
        } else {
          this.messageService.add({
            severity: 'success',
            summary: 'Plant deleted',
            detail: `"${plant.common_name}" removed from your greenhouse.`,
          });
        }
      },
      reject: () => {
        this.plantToDelete.set(null);
      },
    });
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

import { Component, effect, inject, signal } from '@angular/core';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { PlantAlertCardComponent } from './plant-alert-card';
import { SoilCheckDialogComponent } from './soil-check-dialog';
import { PlantFormDialogComponent } from './plant-form-dialog';
import { PlantService } from './plant.service';
import { Plant, PlantFormData } from './plant.model';
import { FloraButtonPT, FloraMessagePT, FloraSkeletonPT } from '../../shared/ui/pt/index';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [Message, SkeletonModule, ButtonModule, PlantAlertCardComponent, SoilCheckDialogComponent, PlantFormDialogComponent],
  templateUrl: './scheduler.html',
})
export class SchedulerComponent {
  protected readonly plantService    = inject(PlantService);
  protected readonly FloraButtonPT   = FloraButtonPT;
  protected readonly FloraMessagePT  = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly loadingPlaceholders = [1, 2, 3];

  readonly selectedPlant   = signal<Plant | null>(null);
  readonly dialogVisible   = signal(false);
  readonly plantFormVisible = signal(false);
  readonly plantFormTarget  = signal<Plant | null>(null);
  readonly plantToDelete    = signal<Plant | null>(null);

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

  onConfirmed(plant: Plant): void {
    void this.plantService.confirmCheck(plant.id);
  }

  onSnoozed(plantId: string): void {
    void this.plantService.snoozeCheck(plantId);
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
  }

  onPlantSaved(data: PlantFormData): void {
    const target = this.plantFormTarget();
    if (target) {
      void this.plantService.updatePlant(target.id, data);
    } else {
      void this.plantService.createPlant(data);
    }
  }
}

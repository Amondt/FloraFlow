import { Component, effect, inject, signal } from '@angular/core';
import { Message } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { PlantAlertCardComponent } from './plant-alert-card';
import { SoilCheckDialogComponent } from './soil-check-dialog';
import { PlantService } from './plant.service';
import { Plant } from './plant.model';
import { FloraMessagePT, FloraSkeletonPT } from '../../shared/ui/pt/index';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [Message, SkeletonModule, PlantAlertCardComponent, SoilCheckDialogComponent],
  templateUrl: './scheduler.html',
})
export class SchedulerComponent {
  protected readonly plantService    = inject(PlantService);
  protected readonly FloraMessagePT  = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly loadingPlaceholders = [1, 2, 3];

  readonly selectedPlant = signal<Plant | null>(null);
  readonly dialogVisible  = signal(false);

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
}

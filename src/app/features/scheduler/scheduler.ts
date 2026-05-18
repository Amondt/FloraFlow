import { Component, effect, inject, signal } from '@angular/core';
import { Message } from 'primeng/message';
import { PlantAlertCardComponent } from './plant-alert-card';
import { SoilCheckDialogComponent } from './soil-check-dialog';
import { PlantService } from './plant.service';
import { Plant } from './plant.model';
import { FloraMessagePT } from '../../shared/ui/pt/index';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [Message, PlantAlertCardComponent, SoilCheckDialogComponent],
  templateUrl: './scheduler.html',
})
export class SchedulerComponent {
  protected readonly plantService    = inject(PlantService);
  protected readonly FloraMessagePT  = FloraMessagePT;
  protected readonly loadingPlaceholders = [1, 2, 3];

  readonly selectedPlant = signal<Plant | null>(null);
  readonly dialogVisible  = signal(false);

  constructor() {
    void this.plantService.loadDuePlants();

    // Clear selectedPlant whenever the dialog closes (any path: confirm, snooze, or X button).
    // allowSignalWrites is required because effects cannot write to signals by default.
    effect(() => {
      if (!this.dialogVisible()) {
        this.selectedPlant.set(null);
      }
    }, { allowSignalWrites: true });
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

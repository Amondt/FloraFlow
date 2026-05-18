import { Component, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { FloraButtonPT } from '../../shared/ui/pt/index';
import { SoilCheckDialogComponent } from './soil-check-dialog';
import { Plant } from './plant.model';

const MOCK_PLANT: Plant = {
  id: 'test-id-001',
  user_id: 'user-001',
  zone_id: 'zone-001',
  common_name: 'Monstera Deliciosa',
  scientific_name: 'Monstera deliciosa',
  perenual_id: null,
  container_vector: 'Terracotta',
  substrate_factor: 'High-Drainage Aroid',
  last_checked_at: null,
  next_check_due_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  current_snooze_interval_days: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

@Component({
  selector: 'app-scheduler',
  standalone: true,
  imports: [ButtonModule, SoilCheckDialogComponent],
  template: `
    <main class="p-6" aria-labelledby="scheduler-heading">
      <section>
        <h1
          id="scheduler-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-4"
        >
          Soil-Check Scheduler
        </h1>
        <p class="text-sm text-neutral-600 mb-6">
          Block D test harness — open the dialog to verify layout and interactions.
        </p>
        <p-button
          label="Open Soil Check Dialog"
          [pt]="FloraButtonPT"
          ariaLabel="Open soil check dialog for Monstera Deliciosa"
          (onClick)="dialogVisible.set(true)"
        />
      </section>

      <app-soil-check-dialog
        [plant]="mockPlant"
        [(visible)]="dialogVisible"
        (confirmed)="onConfirmed($event)"
        (snoozed)="onSnoozed($event)"
      />
    </main>
  `,
})
export class SchedulerComponent {
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly mockPlant = MOCK_PLANT;
  readonly dialogVisible = signal(false);

  onConfirmed(plant: Plant): void {
    console.log('[FloraFlow] Soil confirmed dry for:', plant.common_name);
  }

  onSnoozed(plantId: string): void {
    console.log('[FloraFlow] Snooze triggered for plant ID:', plantId);
  }
}

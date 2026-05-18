import { Component } from '@angular/core';

@Component({
  selector: 'app-scheduler',
  standalone: true,
  template: `
    <main class="p-6" aria-labelledby="scheduler-heading">
      <section>
        <h1
          id="scheduler-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-2"
        >
          Soil-Check Scheduler
        </h1>
        <p class="text-sm text-neutral-600">
          Smart observation alerts and snooze engine — coming in Phase 1.5.
        </p>
      </section>
    </main>
  `,
})
export class SchedulerComponent {}

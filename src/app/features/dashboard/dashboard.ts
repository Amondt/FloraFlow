import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <main class="p-6" aria-labelledby="dashboard-heading">
      <section>
        <h1
          id="dashboard-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-2"
        >
          Virtual Greenhouse
        </h1>
        <p class="text-sm text-neutral-600">
          Zone grid and environmental cards — coming in Phase 1.4.
        </p>
      </section>
    </main>
  `,
})
export class DashboardComponent {}

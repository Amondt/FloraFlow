import { Component } from '@angular/core';

@Component({
  selector: 'app-journal',
  standalone: true,
  template: `
    <main class="p-6" aria-labelledby="journal-heading">
      <section>
        <h1
          id="journal-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-2"
        >
          Care Journal
        </h1>
        <p class="text-sm text-neutral-600">
          Photo timeline and botanical care log — coming in Phase 1.4 / 1.7.
        </p>
      </section>
    </main>
  `,
})
export class JournalComponent {}

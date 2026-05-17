import { Component } from '@angular/core';

@Component({
  selector: 'app-library',
  standalone: true,
  template: `
    <main class="p-6" aria-labelledby="library-heading">
      <section>
        <h1
          id="library-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-2"
        >
          Plant Library
        </h1>
        <p class="text-sm text-neutral-600">
          Browse and filter the botanical registry to discover plants by
          sunlight, watering needs, and toxicity. Coming in Phase 2.
        </p>
      </section>
    </main>
  `,
})
export class LibraryComponent {}

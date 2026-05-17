import { Component } from '@angular/core';

@Component({
  selector: 'app-vault',
  standalone: true,
  template: `
    <main class="p-6" aria-labelledby="vault-heading">
      <section>
        <h1
          id="vault-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-2"
        >
          Seed Vault
        </h1>
        <p class="text-sm text-neutral-600">
          Crop tracking and germination milestone board — coming in Phase 3.3.
        </p>
      </section>
    </main>
  `,
})
export class VaultComponent {}

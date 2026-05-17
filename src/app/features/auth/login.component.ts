import { Component } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <main class="min-h-screen flex items-center justify-center" aria-labelledby="login-heading">
      <section class="bg-neutral-100 rounded-garden-lg p-8 shadow-sm w-full max-w-sm">
        <h1
          id="login-heading"
          class="text-2xl font-semibold font-display text-neutral-900 mb-2"
        >
          Sign in to FloraFlow
        </h1>
        <p class="text-sm text-neutral-600">
          Authentication shell — coming in Phase 1.3.
        </p>
      </section>
    </main>
  `,
})
export class LoginComponent {}

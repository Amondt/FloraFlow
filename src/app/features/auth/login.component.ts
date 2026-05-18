import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloraButtonPT, FloraInputTextPT, FLORA_ERROR } from '../../shared/ui/pt/index';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule],
  template: `
    <main
      class="min-h-screen bg-neutral-50 flex items-center justify-center px-4"
      aria-labelledby="login-heading"
    >
      <article class="w-full max-w-sm bg-white rounded-garden-lg shadow-sm border border-neutral-200 p-8">

        <header class="mb-6">
          <h1
            id="login-heading"
            class="text-2xl font-semibold font-display text-neutral-900"
          >
            Sign in to FloraFlow
          </h1>
          <p class="mt-1 text-sm text-neutral-500 font-display">
            Your smart gardening companion.
          </p>
        </header>

        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          novalidate
          aria-label="Sign in form"
        >
          <section aria-label="Credentials" class="flex flex-col gap-5">

            <!-- Email field -->
            <div class="flex flex-col gap-1.5">
              <label
                for="flora-email"
                class="text-sm font-medium text-neutral-700 font-display"
              >
                Email address
                <span aria-hidden="true" class="text-danger-500 ml-0.5">*</span>
                <span class="sr-only">(required)</span>
              </label>
              <input
                pInputText
                id="flora-email"
                type="email"
                autocomplete="email"
                placeholder="you@example.com"
                formControlName="email"
                [pt]="FloraInputTextPT"
                [class]="email.invalid && email.touched ? FLORA_ERROR : ''"
                [attr.aria-describedby]="email.invalid && email.touched ? 'flora-email-error' : null"
                [attr.aria-invalid]="email.invalid && email.touched"
                aria-required="true"
              />
              @if (email.invalid && email.touched) {
                <small
                  id="flora-email-error"
                  class="text-danger-500 text-xs font-display"
                  role="alert"
                >
                  {{ emailError() }}
                </small>
              }
            </div>

            <!-- Password field -->
            <div class="flex flex-col gap-1.5">
              <label
                for="flora-password"
                class="text-sm font-medium text-neutral-700 font-display"
              >
                Password
                <span aria-hidden="true" class="text-danger-500 ml-0.5">*</span>
                <span class="sr-only">(required)</span>
              </label>
              <input
                pInputText
                id="flora-password"
                type="password"
                autocomplete="current-password"
                placeholder="••••••••"
                formControlName="password"
                [pt]="FloraInputTextPT"
                [class]="password.invalid && password.touched ? FLORA_ERROR : ''"
                [attr.aria-describedby]="password.invalid && password.touched ? 'flora-password-error' : null"
                [attr.aria-invalid]="password.invalid && password.touched"
                aria-required="true"
              />
              @if (password.invalid && password.touched) {
                <small
                  id="flora-password-error"
                  class="text-danger-500 text-xs font-display"
                  role="alert"
                >
                  Password is required.
                </small>
              }
            </div>

            <!-- Auth error banner -->
            @if (authError()) {
              <div
                role="alert"
                class="px-4 py-3 rounded-garden-sm bg-red-50 border border-danger-500 text-red-900 text-sm font-display"
              >
                {{ authError() }}
              </div>
            }

            <!-- Submit -->
            <p-button
              type="submit"
              label="Sign in"
              [pt]="FloraButtonPT"
              [loading]="loading()"
              [disabled]="loading()"
              ariaLabel="Sign in to FloraFlow"
              class="w-full"
              styleClass="w-full justify-center"
            />

          </section>
        </form>

      </article>
    </main>
  `,
})
export class LoginComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router   = inject(Router);

  protected readonly FloraButtonPT   = FloraButtonPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FLORA_ERROR      = FLORA_ERROR;

  readonly form = new FormGroup({
    email:    new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly loading   = signal(false);
  readonly authError = signal('');

  get email()    { return this.form.controls.email; }
  get password() { return this.form.controls.password; }

  readonly emailError = () => {
    if (this.email.hasError('required')) return 'Email address is required.';
    if (this.email.hasError('email'))    return 'Please enter a valid email address.';
    return '';
  };

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.authError.set('');

    const { email, password } = this.form.getRawValue();
    const { error } = await this.supabase.signInWithPassword(email, password);

    if (error) {
      this.authError.set(error.message);
      this.loading.set(false);
      return;
    }

    await this.router.navigate(['/dashboard']);
  }
}

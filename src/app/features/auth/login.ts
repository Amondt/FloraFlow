import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TranslocoPipe } from '@jsverse/transloco';
import { FloraButtonPT, FloraInputTextPT, FLORA_ERROR } from '../../shared/ui/pt/index';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TranslocoPipe],
  templateUrl: './login.html',
})
export class LoginComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  readonly loading = signal(false);
  readonly authError = signal('');

  get email() {
    return this.form.controls.email;
  }
  get password() {
    return this.form.controls.password;
  }

  readonly emailError = () => {
    if (this.email.hasError('required')) return 'auth.login.emailRequired';
    if (this.email.hasError('email')) return 'auth.login.emailInvalid';
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

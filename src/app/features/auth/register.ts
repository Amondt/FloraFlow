import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TranslocoPipe } from '@jsverse/transloco';
import { FloraButtonPT, FloraInputTextPT, FLORA_ERROR } from '../../shared/ui/pt/index';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthPageControlsComponent } from '../../shared/components/auth-page-controls/auth-page-controls';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string;
  const confirmPassword = group.get('confirmPassword')?.value as string;
  return password === confirmPassword ? null : { passwordsMatch: true };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TranslocoPipe,
    RouterLink,
    AuthPageControlsComponent,
  ],
  templateUrl: './register.html',
})
export class RegisterComponent {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FLORA_ERROR = FLORA_ERROR;

  readonly form = new FormGroup(
    {
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatch },
  );

  readonly loading = signal(false);
  readonly authError = signal('');
  readonly state = signal<'form' | 'confirmation-pending'>('form');
  readonly submittedEmail = signal('');

  get email() {
    return this.form.controls.email;
  }
  get password() {
    return this.form.controls.password;
  }
  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  readonly emailError = (): string => {
    if (this.email.hasError('required')) return 'auth.register.emailRequired';
    if (this.email.hasError('email')) return 'auth.register.emailInvalid';
    return '';
  };

  readonly passwordError = (): string => {
    if (this.password.hasError('required')) return 'auth.register.passwordRequired';
    if (this.password.hasError('minlength')) return 'auth.register.passwordMinLength';
    return '';
  };

  readonly confirmPasswordError = (): string => {
    if (this.confirmPassword.hasError('required')) return 'auth.register.confirmPasswordRequired';
    if (this.form.hasError('passwordsMatch')) return 'auth.register.passwordsMismatch';
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
    const { error, needsEmailConfirmation } = await this.supabase.signUp(email, password);

    if (error) {
      this.authError.set(error.message);
      this.loading.set(false);
      return;
    }

    if (needsEmailConfirmation) {
      this.submittedEmail.set(email);
      this.state.set('confirmation-pending');
      return;
    }

    await this.router.navigate(['/dashboard']);
  }
}

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Router } from '@angular/router';
import type { AuthError } from '@supabase/supabase-js';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import { RegisterComponent } from './register';
import { SupabaseService } from '../../core/services/supabase.service';

describe('RegisterComponent', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let mockSignUp: ReturnType<typeof vi.fn>;
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockSignUp = vi.fn();
    mockNavigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        ...provideTranslocoTesting(),
        { provide: SupabaseService, useValue: { signUp: mockSignUp } },
        { provide: Router, useValue: { navigate: mockNavigate } },
      ],
    })
      .overrideTemplate(RegisterComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fillForm(
    email = 'user@example.com',
    password = 'password123',
    confirmPassword = 'password123',
  ): void {
    component.form.setValue({ email, password, confirmPassword });
  }

  // ─── passwordsMatch group validator ───────────────────────────────────────

  describe('passwordsMatch group validator', () => {
    it('is absent when passwords match', () => {
      fillForm();
      expect(component.form.hasError('passwordsMatch')).toBe(false);
    });

    it('is present when passwords differ', () => {
      fillForm('user@example.com', 'password123', 'different99');
      expect(component.form.hasError('passwordsMatch')).toBe(true);
    });
  });

  // ─── error key selectors ──────────────────────────────────────────────────

  describe('emailError()', () => {
    it('returns the required key when email is blank', () => {
      component.form.controls.email.setValue('');
      expect(component.emailError()).toBe('auth.register.emailRequired');
    });

    it('returns the invalid key when email format is wrong', () => {
      component.form.controls.email.setValue('not-an-email');
      expect(component.emailError()).toBe('auth.register.emailInvalid');
    });
  });

  describe('passwordError()', () => {
    it('returns the required key when password is blank', () => {
      component.form.controls.password.setValue('');
      expect(component.passwordError()).toBe('auth.register.passwordRequired');
    });

    it('returns the minlength key when password is too short', () => {
      component.form.controls.password.setValue('short');
      expect(component.passwordError()).toBe('auth.register.passwordMinLength');
    });
  });

  describe('confirmPasswordError()', () => {
    it('returns the required key when confirmPassword is blank', () => {
      component.form.controls.confirmPassword.setValue('');
      expect(component.confirmPasswordError()).toBe('auth.register.confirmPasswordRequired');
    });

    it('returns the mismatch key when passwords differ', () => {
      fillForm('user@example.com', 'password123', 'mismatch99');
      expect(component.confirmPasswordError()).toBe('auth.register.passwordsMismatch');
    });
  });

  // ─── onSubmit() guard ─────────────────────────────────────────────────────

  describe('onSubmit() — invalid form', () => {
    it('does not call signUp when the form is invalid', async () => {
      // leave form empty — all fields required
      await component.onSubmit();
      expect(mockSignUp).not.toHaveBeenCalled();
    });

    it('marks all fields as touched so errors become visible', async () => {
      const spy = vi.spyOn(component.form, 'markAllAsTouched');
      await component.onSubmit();
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  // ─── onSubmit() — error path ─────────────────────────────────────────────

  describe('onSubmit() — signUp returns an error', () => {
    beforeEach(() => {
      const fakeError = { message: 'Email already registered' } as AuthError;
      mockSignUp.mockResolvedValue({ error: fakeError, needsEmailConfirmation: false });
    });

    it('sets authError to the error message', async () => {
      fillForm();
      await component.onSubmit();
      expect(component.authError()).toBe('Email already registered');
    });

    it('resets loading to false', async () => {
      fillForm();
      await component.onSubmit();
      expect(component.loading()).toBe(false);
    });

    it('does not navigate', async () => {
      fillForm();
      await component.onSubmit();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('keeps field values intact (forgiveness — §7.4)', async () => {
      fillForm('keep@example.com');
      await component.onSubmit();
      expect(component.form.controls.email.value).toBe('keep@example.com');
    });
  });

  // ─── onSubmit() — confirmation-pending path ───────────────────────────────

  describe('onSubmit() — needsEmailConfirmation', () => {
    beforeEach(() => {
      mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: true });
    });

    it('switches state to confirmation-pending', async () => {
      fillForm('pending@example.com');
      await component.onSubmit();
      expect(component.state()).toBe('confirmation-pending');
    });

    it('stores the submitted email for display', async () => {
      fillForm('pending@example.com');
      await component.onSubmit();
      expect(component.submittedEmail()).toBe('pending@example.com');
    });

    it('does not navigate', async () => {
      fillForm();
      await component.onSubmit();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  // ─── onSubmit() — auto-confirmed success path ─────────────────────────────

  describe('onSubmit() — auto-confirmed (no error, no confirmation)', () => {
    beforeEach(() => {
      mockSignUp.mockResolvedValue({ error: null, needsEmailConfirmation: false });
    });

    it('navigates to /dashboard', async () => {
      fillForm();
      await component.onSubmit();
      expect(mockNavigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('does not switch to confirmation-pending state', async () => {
      fillForm();
      await component.onSubmit();
      expect(component.state()).toBe('form');
    });

    it('calls signUp with the correct email and password', async () => {
      fillForm('new@example.com', 'mypassword', 'mypassword');
      await component.onSubmit();
      expect(mockSignUp).toHaveBeenCalledWith('new@example.com', 'mypassword');
    });
  });
});

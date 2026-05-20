import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import type { Session } from '@supabase/supabase-js';
import { authGuard } from './auth.guard';
import { SupabaseService } from '../services/supabase.service';

const FAKE_SESSION = { access_token: 'tok' } as unknown as Session;

describe('authGuard', () => {
  let sessionSignal: ReturnType<typeof signal<Session | null | undefined>>;
  let mockParseUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionSignal = signal<Session | null | undefined>(null);
    mockParseUrl   = vi.fn().mockReturnValue('url-tree-/login');

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { session: sessionSignal, sessionReady: Promise.resolve() },
        },
        {
          provide: Router,
          useValue: { parseUrl: mockParseUrl },
        },
      ],
    }).compileComponents();
  });

  it('returns true when an active session exists', async () => {
    sessionSignal.set(FAKE_SESSION);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
    expect(mockParseUrl).not.toHaveBeenCalled();
  });

  it('redirects to /login when session is null', async () => {
    sessionSignal.set(null);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(mockParseUrl).toHaveBeenCalledWith('/login');
    expect(result).toBe('url-tree-/login');
  });
});

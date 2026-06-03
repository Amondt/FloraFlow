import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import type { Database } from '../../../types/database.types';
import { onboardingGuard } from './onboarding.guard';
import { ProfileService } from '../services/profile.service';

type Profile = Database['public']['Tables']['profiles']['Row'];

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    has_completed_onboarding: false,
    push_subscription: null,
    ...overrides,
  } as Profile;
}

describe('onboardingGuard', () => {
  let profileSignal: ReturnType<typeof signal<Profile | null>>;
  let mockLoadProfile: ReturnType<typeof vi.fn>;
  let mockParseUrl: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    profileSignal = signal<Profile | null>(null);
    mockLoadProfile = vi.fn().mockResolvedValue(undefined);
    mockParseUrl = vi.fn().mockReturnValue('url-tree-/onboarding');

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: ProfileService,
          useValue: {
            profile: profileSignal,
            profileReady: Promise.resolve(),
            loadProfileForCurrentSession: mockLoadProfile,
          },
        },
        { provide: Router, useValue: { parseUrl: mockParseUrl } },
      ],
    }).compileComponents();
  });

  it('returns true when onboarding is complete', async () => {
    profileSignal.set(makeProfile({ has_completed_onboarding: true }));

    const result = await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(result).toBe(true);
    expect(mockParseUrl).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when onboarding is not yet complete', async () => {
    profileSignal.set(makeProfile({ has_completed_onboarding: false }));

    const result = await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(mockParseUrl).toHaveBeenCalledWith('/onboarding');
    expect(result).toBe('url-tree-/onboarding');
  });

  it('redirects to /onboarding when profile is null', async () => {
    profileSignal.set(null);

    const result = await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(mockParseUrl).toHaveBeenCalledWith('/onboarding');
    expect(result).toBe('url-tree-/onboarding');
  });

  it('always calls loadProfileForCurrentSession before making the decision', async () => {
    profileSignal.set(makeProfile({ has_completed_onboarding: true }));

    await TestBed.runInInjectionContext(() =>
      onboardingGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

    expect(mockLoadProfile).toHaveBeenCalledOnce();
  });
});

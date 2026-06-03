import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProfileService } from '../services/profile.service';

export const onboardingGuard: CanActivateFn = async () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  await profileService.profileReady;

  // profileReady settles after the first auth event. When the user logs in
  // after clearing local storage that first event was a null session, so the
  // profile was never fetched. Load it now before making the guard decision.
  await profileService.loadProfileForCurrentSession();

  return profileService.profile()?.has_completed_onboarding === true
    ? true
    : router.parseUrl('/onboarding');
};

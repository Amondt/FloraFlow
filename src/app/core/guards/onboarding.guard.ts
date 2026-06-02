import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProfileService } from '../services/profile.service';

export const onboardingGuard: CanActivateFn = async () => {
  const profileService = inject(ProfileService);
  const router = inject(Router);

  await profileService.profileReady;
  return profileService.profile()?.has_completed_onboarding === true
    ? true
    : router.parseUrl('/onboarding');
};

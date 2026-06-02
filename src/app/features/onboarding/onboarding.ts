import { Component, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  templateUrl: './onboarding.html',
})
export class OnboardingComponent {
  protected readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      if (this.profileService.profile()?.has_completed_onboarding) {
        void this.router.navigateByUrl('/dashboard');
      }
    });
  }

  protected async complete(): Promise<void> {
    await this.profileService.completeOnboarding();
  }
}

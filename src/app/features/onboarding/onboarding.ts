import { Component, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProfileService } from '../../core/services/profile.service';
import { ZoneService } from '../dashboard/zone.service';
import { createZoneFormGroup, ZoneFormData } from '../dashboard/zone.model';
import { ZoneFormFieldsComponent } from '../dashboard/zone-form-fields/zone-form-fields';
import { FloraButtonPT, FloraMessagePT } from '../../shared/ui/pt/index';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    MessageModule,
    ZoneFormFieldsComponent,
    TranslocoPipe,
  ],
  templateUrl: './onboarding.html',
})
export class OnboardingComponent {
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);
  protected readonly zoneService = inject(ZoneService);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraMessagePT = FloraMessagePT;

  protected readonly currentStep = signal<1 | 2 | 3>(1);
  protected readonly form = createZoneFormGroup();

  constructor() {
    effect(() => {
      if (this.profileService.profile()?.has_completed_onboarding) {
        void this.router.navigateByUrl('/dashboard');
      }
    });
  }

  protected goToStep2(): void {
    this.currentStep.set(2);
  }

  protected async saveZone(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    await this.zoneService.createZone(this.form.getRawValue() as ZoneFormData);

    if (!this.zoneService.error()) {
      this.currentStep.set(3);
    }
  }

  protected async finish(): Promise<void> {
    await this.profileService.completeOnboarding();
    void this.router.navigateByUrl('/dashboard');
  }
}

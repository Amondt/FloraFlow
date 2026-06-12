import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  confidenceBadgeClass,
  confidenceBadgeKey,
  riskBadgeClass,
  riskBadgeKey,
} from '../leaf-doctor.utils';

@Component({
  selector: 'app-leaf-doctor-badges',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './leaf-doctor-badges.html',
})
export class LeafDoctorBadgesComponent {
  private readonly t = inject(TranslocoService);

  readonly confidenceScore = input.required<number>();
  readonly riskAssessment = input.required<string>();

  protected readonly confidenceBadgeClass = confidenceBadgeClass;
  protected readonly riskBadgeClass = riskBadgeClass;

  protected readonly confidenceLabel = computed(() =>
    this.t.translate(confidenceBadgeKey(this.confidenceScore())),
  );

  protected readonly riskLabel = computed(() =>
    this.t.translate(riskBadgeKey(this.riskAssessment())),
  );

  protected readonly confidenceAriaLabel = computed(() =>
    this.t.translate('leafDoctor.badge.confidenceAriaLabel', { label: this.confidenceLabel() }),
  );

  protected readonly riskAriaLabel = computed(() =>
    this.t.translate('leafDoctor.badge.riskAriaLabel', { label: this.riskLabel() }),
  );
}

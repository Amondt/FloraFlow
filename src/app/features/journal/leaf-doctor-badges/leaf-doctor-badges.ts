import { Component, input } from '@angular/core';
import {
  confidenceBadgeClass,
  confidenceBadgeLabel,
  riskBadgeClass,
  riskBadgeLabel,
} from '../leaf-doctor.utils';

@Component({
  selector: 'app-leaf-doctor-badges',
  standalone: true,
  imports: [],
  templateUrl: './leaf-doctor-badges.html',
})
export class LeafDoctorBadgesComponent {
  readonly confidenceScore = input.required<number>();
  readonly riskAssessment = input.required<string>();

  protected readonly confidenceBadgeClass = confidenceBadgeClass;
  protected readonly confidenceBadgeLabel = confidenceBadgeLabel;
  protected readonly riskBadgeClass = riskBadgeClass;
  protected readonly riskBadgeLabel = riskBadgeLabel;
}

import { Component, computed, input, output } from '@angular/core';
import { Zone } from '../zone.model';

const COMPASS_ANGLES: Record<string, number> = {
  North: 0, Northeast: 45, East: 90, Southeast: 135,
  South: 180, Southwest: 225, West: 270, Northwest: 315, None: 0,
};

@Component({
  selector: 'app-zone-card',
  standalone: true,
  imports: [],
  templateUrl: './zone-card.html',
})
export class ZoneCardComponent {
  readonly zone         = input.required<Zone>();
  readonly plantCount   = input(0);
  readonly overdueCount = input(0);
  readonly plantNames   = input<string[]>([]);
  readonly edit         = output<Zone>();
  readonly remove       = output<string>();

  readonly headingId = computed(() => `zone-heading-${this.zone().id}`);

  readonly compassAngle = computed(() =>
    COMPASS_ANGLES[this.zone().window_orientation] ?? 0
  );

  readonly compassTransform = computed(() =>
    `rotate(${this.compassAngle()}deg)`
  );

  readonly statusLabel = computed(() => {
    const n = this.overdueCount();
    return n > 0 ? `${n} overdue` : 'All clear';
  });

  readonly isOverdue = computed(() => this.overdueCount() > 0);

  readonly plantSummary = computed(() => {
    const names = this.plantNames();
    const total = this.plantCount();
    if (total === 0) return 'No plants yet';
    const shown = names.slice(0, 2).join(', ');
    const extra = total - 2;
    return extra > 0 ? `${shown} +${extra}` : shown;
  });
}

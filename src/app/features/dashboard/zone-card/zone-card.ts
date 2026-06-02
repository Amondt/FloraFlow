import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FLORA_FOCUS } from '../../../shared/ui/pt/states.pt';
import { Zone } from '../zone.model';

const COMPASS_ANGLES: Record<string, number> = {
  North: 0,
  Northeast: 45,
  East: 90,
  Southeast: 135,
  South: 180,
  Southwest: 225,
  West: 270,
  Northwest: 315,
  None: 0,
};

@Component({
  selector: 'app-zone-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './zone-card.html',
})
export class ZoneCardComponent {
  readonly zone = input.required<Zone>();
  readonly plantCount = input(0);
  readonly overdueCount = input(0);
  readonly dueTodayCount = input(0);
  readonly plantNames = input<string[]>([]);
  readonly edit = output<Zone>();
  readonly remove = output<string>();

  readonly headingId = computed(() => `zone-heading-${this.zone().id}`);

  protected readonly cardLinkClass = `absolute inset-0 rounded-garden-md ${FLORA_FOCUS}`;

  readonly compassAngle = computed(() => COMPASS_ANGLES[this.zone().window_orientation] ?? 0);

  readonly hasOrientation = computed(() => this.zone().window_orientation !== 'None');

  readonly lightLabel = computed(() => {
    const o = this.zone().window_orientation;
    return o === 'None' ? 'No window' : o;
  });

  protected readonly compassTicks = [45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    return {
      x1: parseFloat((40 + 27 * sin).toFixed(1)),
      y1: parseFloat((40 - 27 * cos).toFixed(1)),
      x2: parseFloat((40 + 31 * sin).toFixed(1)),
      y2: parseFloat((40 - 31 * cos).toFixed(1)),
    };
  });

  readonly statusLabel = computed(() => {
    const overdue = this.overdueCount();
    const dueToday = this.dueTodayCount();
    if (overdue > 0) return `${overdue} overdue`;
    if (dueToday > 0) return `${dueToday} due today`;
    return 'All clear';
  });

  readonly hasAttention = computed(() => this.overdueCount() > 0 || this.dueTodayCount() > 0);

  readonly plantSummary = computed(() => {
    const names = this.plantNames();
    const total = this.plantCount();
    if (total === 0) return 'No plants yet';
    const shown = names.slice(0, 2).join(', ');
    const extra = total - 2;
    return extra > 0 ? `${shown} +${extra}` : shown;
  });
}

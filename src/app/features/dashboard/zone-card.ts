import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { FloraButtonPT } from '../../shared/ui/pt/index';
import { Zone } from './zone.model';

@Component({
  selector: 'app-zone-card',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './zone-card.html',
})
export class ZoneCardComponent {
  readonly zone   = input.required<Zone>();
  readonly edit   = output<Zone>();
  readonly remove = output<string>();

  protected readonly FloraButtonPT = FloraButtonPT;

  readonly headingId = computed(() => `zone-heading-${this.zone().id}`);
}

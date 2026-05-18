import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FloraButtonPT, FloraTagPT } from '../../shared/ui/pt/index';
import { Zone } from './zone.model';

@Component({
  selector: 'app-zone-card',
  standalone: true,
  imports: [ButtonModule, TagModule],
  templateUrl: './zone-card.html',
})
export class ZoneCardComponent {
  readonly zone   = input.required<Zone>();
  readonly edit   = output<Zone>();
  readonly remove = output<string>();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraTagPT    = FloraTagPT;

  readonly headingId = computed(() => `zone-heading-${this.zone().id}`);
}

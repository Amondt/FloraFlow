import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ZoneService } from '../zone.service';

@Component({
  selector: 'app-zone-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './zone-detail.html',
})
export class ZoneDetailComponent {
  readonly id = input<string>('');

  protected readonly zoneService = inject(ZoneService);

  protected readonly zone = computed(() =>
    this.zoneService.zones().find((z) => z.id === this.id()),
  );

  constructor() {
    void this.zoneService.loadZones();
  }
}

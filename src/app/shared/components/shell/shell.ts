import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavComponent } from '../nav/nav';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { OfflineQueueService } from '../../../core/services/offline-queue.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { PlantService } from '../../../features/scheduler/plant.service';
import { ZoneService } from '../../../features/dashboard/zone.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, NavComponent],
  templateUrl: './shell.html',
})
export class ShellComponent {
  protected readonly networkStatus = inject(NetworkStatusService);
  protected readonly offlineQueue = inject(OfflineQueueService);
  protected readonly plantService = inject(PlantService);
  protected readonly zoneService = inject(ZoneService);

  private readonly pushNotification = inject(PushNotificationService);
  private readonly router = inject(Router);

  constructor() {
    void this.pushNotification.initializePush();
  }

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly offlineMessage = computed(() => {
    const url = this.currentUrl() ?? '';
    if (url.startsWith('/scheduler'))
      return 'You are offline. Soil checks will sync when reconnected.';
    if (url.startsWith('/dashboard'))
      return 'You are offline. Zone changes will sync when reconnected.';
    if (url.startsWith('/journal')) return 'You are offline. Journal is read-only.';
    if (url.startsWith('/library')) return 'You are offline. Plant library is unavailable.';
    if (url.startsWith('/vault')) return 'You are offline. Vault is unavailable.';
    return 'You are offline.';
  });

  protected readonly isSyncing = computed(
    () => this.plantService.isSyncing() || this.zoneService.isSyncing(),
  );
}

import { Injectable, DestroyRef, afterNextRender, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkStatusService {
  private readonly destroyRef = inject(DestroyRef);

  readonly isOnline = signal<boolean>(navigator.onLine);

  constructor() {
    afterNextRender(() => {
      const onOnline = () => this.isOnline.set(true);
      const onOffline = () => this.isOnline.set(false);

      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      });
    });
  }
}

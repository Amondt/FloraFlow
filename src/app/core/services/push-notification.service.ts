import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { urlBase64ToUint8Array } from '../../shared/utils/vapid.util';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly supabase = inject(SupabaseService);

  async initializePush(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    // Exit if no service worker is registered — navigator.serviceWorker.ready
    // never resolves without one, which would stall the promise indefinitely.
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) return;

    await this.supabase.sessionReady;
    const session = await this.supabase.getSession();
    if (!session) return;

    const { data: profile } = await this.supabase.client
      .from('profiles')
      .select('push_subscription')
      .eq('id', session.user.id)
      .single();

    if (profile?.push_subscription) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(environment.vapidPublicKey),
    });

    const { error: updateError } = await this.supabase.client
      .from('profiles')
      .update({ push_subscription: subscription.toJSON() })
      .eq('id', session.user.id);

    if (updateError) {
      console.error(
        'PushNotificationService: failed to persist push subscription',
        updateError.message,
      );
    }
  }
}

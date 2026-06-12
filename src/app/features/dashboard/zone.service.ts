import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { Zone, ZoneFormData, WindowOrientation } from './zone.model';

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private readonly supabase = inject(SupabaseService);
  private readonly networkStatus = inject(NetworkStatusService);
  private readonly offlineQueue = inject(OfflineQueueService);

  readonly zones = signal<Zone[]>([]);
  readonly zoneMap = computed(() => new Map(this.zones().map((z) => [z.id, z])));
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly isSyncing = signal(false);

  constructor() {
    effect(() => {
      if (this.networkStatus.isOnline()) {
        void this._drainZoneQueue();
      }
    });
  }

  async loadZones(): Promise<void> {
    if (!this.networkStatus.isOnline() && this.zones().length > 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('zones')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      this.error.set(error.message);
    } else {
      this.zones.set((data ?? []) as Zone[]);
    }

    this.loading.set(false);
  }

  async createZone(formData: ZoneFormData): Promise<void> {
    this.error.set(null);

    if (!this.networkStatus.isOnline()) {
      const tempId = `offline-zone-${crypto.randomUUID()}`;
      const now = new Date().toISOString();

      const optimisticZone: Zone = {
        id: tempId,
        user_id: '',
        ...formData,
        created_at: now,
        updated_at: now,
      };

      this.zones.update((all) => [...all, optimisticZone]);
      await this.offlineQueue.enqueue({
        id: crypto.randomUUID(),
        action: 'create-zone',
        plant_id: tempId,
        queued_at: now,
        zone_name: formData.name,
        zone_icon: formData.icon,
        zone_type: formData.zone_type,
        zone_window_orientation: formData.window_orientation,
        zone_has_active_ventilation: formData.has_active_ventilation,
        zone_has_grow_lights: formData.has_grow_lights,
        zone_humidity_baseline: formData.humidity_baseline,
      });
      return;
    }

    this.loading.set(true);

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();

    if (!user) {
      this.error.set('Not authenticated.');
      this.loading.set(false);
      return;
    }

    const { error } = await this.supabase.client
      .from('zones')
      .insert({ ...formData, user_id: user.id });

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadZones();
    }

    this.loading.set(false);
  }

  async updateZone(id: string, formData: ZoneFormData): Promise<void> {
    this.error.set(null);

    if (!this.networkStatus.isOnline()) {
      const now = new Date().toISOString();
      this.zones.update((all) =>
        all.map((z) => (z.id === id ? { ...z, ...formData, updated_at: now } : z)),
      );
      await this.offlineQueue.enqueue({
        id: crypto.randomUUID(),
        action: 'update-zone',
        plant_id: id,
        queued_at: now,
        zone_name: formData.name,
        zone_icon: formData.icon,
        zone_type: formData.zone_type,
        zone_window_orientation: formData.window_orientation,
        zone_has_active_ventilation: formData.has_active_ventilation,
        zone_has_grow_lights: formData.has_grow_lights,
        zone_humidity_baseline: formData.humidity_baseline,
      });
      return;
    }

    this.loading.set(true);

    const { error } = await this.supabase.client.from('zones').update(formData).eq('id', id);

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadZones();
    }

    this.loading.set(false);
  }

  async deleteZone(id: string): Promise<void> {
    this.error.set(null);

    if (!this.networkStatus.isOnline()) {
      this.zones.update((all) => all.filter((z) => z.id !== id));
      await this.offlineQueue.enqueue({
        id: crypto.randomUUID(),
        action: 'delete-zone',
        plant_id: id,
        queued_at: new Date().toISOString(),
      });
      return;
    }

    this.loading.set(true);

    const { error } = await this.supabase.client.from('zones').delete().eq('id', id);

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadZones();
    }

    this.loading.set(false);
  }

  private async _drainZoneQueue(): Promise<void> {
    if (this.isSyncing()) return;

    const allItems = await this.offlineQueue.getAll();
    const items = allItems.filter(
      (item) =>
        item.action === 'create-zone' ||
        item.action === 'update-zone' ||
        item.action === 'delete-zone',
    );

    if (items.length === 0) return;

    this.isSyncing.set(true);

    let userId: string | null = null;
    if (items.some((item) => item.action === 'create-zone')) {
      const {
        data: { user },
      } = await this.supabase.client.auth.getUser();
      userId = user?.id ?? null;
    }

    for (const item of items) {
      try {
        let dbError: { message: string } | null = null;

        if (item.action === 'create-zone') {
          if (!userId) {
            dbError = { message: 'Not authenticated' };
          } else {
            const { error } = await this.supabase.client.from('zones').insert({
              user_id: userId,
              name: item.zone_name!,
              icon: item.zone_icon!,
              zone_type: item.zone_type ?? 'indoor',
              window_orientation: item.zone_window_orientation as WindowOrientation,
              has_active_ventilation: item.zone_has_active_ventilation ?? false,
              has_grow_lights: item.zone_has_grow_lights ?? false,
              humidity_baseline: item.zone_humidity_baseline ?? 40,
            });
            dbError = error;
          }
        } else if (item.action === 'update-zone') {
          const { error } = await this.supabase.client
            .from('zones')
            .update({
              name: item.zone_name!,
              icon: item.zone_icon!,
              zone_type: item.zone_type ?? 'indoor',
              window_orientation: item.zone_window_orientation as WindowOrientation,
              has_active_ventilation: item.zone_has_active_ventilation ?? false,
              has_grow_lights: item.zone_has_grow_lights ?? false,
              humidity_baseline: item.zone_humidity_baseline ?? 40,
            })
            .eq('id', item.plant_id);
          dbError = error;
        } else if (item.action === 'delete-zone') {
          const { error } = await this.supabase.client
            .from('zones')
            .delete()
            .eq('id', item.plant_id);
          dbError = error;
        }

        if (dbError) {
          console.error('[FloraFlow] zone queue replay failed:', dbError.message, item);
        } else {
          await this.offlineQueue.remove(item.id);
        }
      } catch (e) {
        console.error('[FloraFlow] zone queue replay threw:', e, item);
      }
    }

    this.isSyncing.set(false);
    await this.loadZones();
  }
}

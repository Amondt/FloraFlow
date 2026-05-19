import { Injectable, inject, signal, effect } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { Plant, PlantFormData, ContainerVector, SubstrateFactor } from './plant.model';

@Injectable({ providedIn: 'root' })
export class PlantService {
  private readonly supabase       = inject(SupabaseService);
  private readonly networkStatus  = inject(NetworkStatusService);
  private readonly offlineQueue   = inject(OfflineQueueService);

  readonly plants    = signal<Plant[]>([]);
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);
  readonly isSyncing = signal(false);

  constructor() {
    effect(() => {
      if (this.networkStatus.isOnline()) {
        void this._drainQueue();
      }
    });
  }

  async loadPlants(): Promise<void> {
    if (!this.networkStatus.isOnline() && this.plants().length > 0) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('plants')
      .select('id, common_name, scientific_name, zone_id, next_check_due_at, last_checked_at, current_snooze_interval_days, container_vector, substrate_factor')
      .order('next_check_due_at', { ascending: true });

    if (error) {
      this.error.set(error.message);
    } else {
      this.plants.set((data ?? []) as Plant[]);
    }

    this.loading.set(false);
  }

  async confirmCheck(plantId: string): Promise<void> {
    this.error.set(null);

    if (!this.networkStatus.isOnline()) {
      const now = new Date().toISOString();
      this.plants.update(all =>
        all.map(p => {
          if (p.id !== plantId) return p;
          const nextDue = new Date();
          nextDue.setDate(nextDue.getDate() + p.current_snooze_interval_days);
          return { ...p, last_checked_at: now, next_check_due_at: nextDue.toISOString() };
        })
      );
      await this.offlineQueue.enqueue({
        id: crypto.randomUUID(),
        action: 'confirm',
        plant_id: plantId,
        queued_at: now,
      });
      return;
    }

    const { error } = await this.supabase.client.rpc('confirm_plant_check', {
      p_plant_id: plantId,
    });

    if (error) {
      this.error.set(error.message);
    } else {
      await this._refreshPlant(plantId);
    }
  }

  async snoozeCheck(plantId: string): Promise<void> {
    this.error.set(null);

    if (!this.networkStatus.isOnline()) {
      const plant = this.plants().find(p => p.id === plantId);
      const snoozeDays = plant?.current_snooze_interval_days ?? 3;
      const now = new Date().toISOString();
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + snoozeDays);
      this.plants.update(all =>
        all.map(p => {
          if (p.id !== plantId) return p;
          return { ...p, last_checked_at: now, next_check_due_at: nextDue.toISOString() };
        })
      );
      await this.offlineQueue.enqueue({
        id: crypto.randomUUID(),
        action: 'snooze',
        plant_id: plantId,
        snooze_days: snoozeDays,
        queued_at: now,
      });
      return;
    }

    const { error } = await this.supabase.client.rpc('snooze_plant_check', {
      p_plant_id: plantId,
    });

    if (error) {
      this.error.set(error.message);
    } else {
      await this._refreshPlant(plantId);
    }
  }

  private async _refreshPlant(plantId: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('plants')
      .select('id, common_name, scientific_name, zone_id, next_check_due_at, last_checked_at, current_snooze_interval_days, container_vector, substrate_factor')
      .eq('id', plantId)
      .single();

    if (error) {
      await this.loadPlants();
    } else if (data) {
      this.plants.update(all => all.map(p => (p.id === plantId ? (data as Plant) : p)));
    }
  }

  private async _drainQueue(): Promise<void> {
    if (this.isSyncing()) return;

    const items = await this.offlineQueue.getAll();
    if (items.length === 0) return;

    this.isSyncing.set(true);

    for (const item of items) {
      try {
        let rpcError: { message: string } | null = null;

        if (item.action === 'confirm') {
          const { error } = await this.supabase.client.rpc('confirm_plant_check', {
            p_plant_id: item.plant_id,
          });
          rpcError = error;
        } else if (item.action === 'snooze') {
          const { error } = await this.supabase.client.rpc('snooze_plant_check', {
            p_plant_id: item.plant_id,
          });
          rpcError = error;
        } else if (item.action === 'create') {
          const { data: { user } } = await this.supabase.client.auth.getUser();
          if (!user) {
            rpcError = { message: 'Not authenticated' };
          } else {
            const { error } = await this.supabase.client
              .from('plants')
              .insert({
                common_name: item.common_name!,
                scientific_name: item.scientific_name ?? null,
                zone_id: item.zone_id!,
                container_vector: item.container_vector as ContainerVector,
                substrate_factor: item.substrate_factor as SubstrateFactor,
                user_id: user.id,
              });
            rpcError = error;
          }
        }

        if (rpcError) {
          console.error('[FloraFlow] queue replay failed:', rpcError.message, item);
        } else {
          await this.offlineQueue.remove(item.id);
        }
      } catch (e) {
        console.error('[FloraFlow] queue replay threw:', e, item);
      }
    }

    this.isSyncing.set(false);
    await this.loadPlants();
  }

  async createPlant(data: PlantFormData): Promise<void> {
    if (!this.networkStatus.isOnline()) {
      const tempId = `offline-${crypto.randomUUID()}`;
      const now = new Date().toISOString();
      const nextDue = new Date();
      nextDue.setDate(nextDue.getDate() + 3);

      const optimisticPlant: Plant = {
        id: tempId,
        user_id: '',
        zone_id: data.zone_id,
        common_name: data.common_name,
        scientific_name: data.scientific_name,
        perenual_id: null,
        container_vector: data.container_vector,
        substrate_factor: data.substrate_factor,
        last_checked_at: null,
        next_check_due_at: nextDue.toISOString(),
        current_snooze_interval_days: 3,
        created_at: now,
        updated_at: now,
      };

      this.plants.update(all => [...all, optimisticPlant]);
      await this.offlineQueue.enqueue({
        id: crypto.randomUUID(),
        action: 'create',
        plant_id: tempId,
        queued_at: now,
        common_name: data.common_name,
        scientific_name: data.scientific_name,
        zone_id: data.zone_id,
        container_vector: data.container_vector,
        substrate_factor: data.substrate_factor,
      });
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const { data: { user } } = await this.supabase.client.auth.getUser();

    if (!user) {
      this.error.set('Not authenticated.');
      this.loading.set(false);
      return;
    }

    const { data: inserted, error } = await this.supabase.client
      .from('plants')
      .insert({ ...data, user_id: user.id })
      .select('id, common_name, scientific_name, next_check_due_at, container_vector, substrate_factor, zone_id')
      .single();

    if (error) {
      this.error.set(error.message);
    } else if (inserted) {
      this.plants.update(all => [...all, inserted as Plant]);
    }

    this.loading.set(false);
  }

  async updatePlant(id: string, data: PlantFormData): Promise<void> {
    this.error.set(null);

    const { error } = await this.supabase.client
      .from('plants')
      .update(data)
      .eq('id', id);

    if (error) {
      this.error.set(error.message);
    } else {
      await this._refreshPlant(id);
    }
  }

  async deletePlant(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.supabase.client
      .from('plants')
      .delete()
      .eq('id', id);

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadPlants();
    }

    this.loading.set(false);
  }
}

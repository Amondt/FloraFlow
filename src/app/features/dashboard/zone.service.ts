import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Zone, ZoneFormData } from './zone.model';

@Injectable({ providedIn: 'root' })
export class ZoneService {
  private readonly supabase = inject(SupabaseService);

  readonly zones   = signal<Zone[]>([]);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  async loadZones(): Promise<void> {
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
    this.loading.set(true);
    this.error.set(null);

    const { data: { user } } = await this.supabase.client.auth.getUser();

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
    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.supabase.client
      .from('zones')
      .update(formData)
      .eq('id', id);

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadZones();
    }

    this.loading.set(false);
  }

  async deleteZone(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.supabase.client
      .from('zones')
      .delete()
      .eq('id', id);

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadZones();
    }

    this.loading.set(false);
  }
}

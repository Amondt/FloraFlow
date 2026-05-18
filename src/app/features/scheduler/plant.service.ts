import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Plant } from './plant.model';

@Injectable({ providedIn: 'root' })
export class PlantService {
  private readonly supabase = inject(SupabaseService);

  readonly duePlants = signal<Plant[]>([]);
  readonly loading   = signal(false);
  readonly error     = signal<string | null>(null);

  async loadDuePlants(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('plants')
      .select('*')
      .lte('next_check_due_at', new Date().toISOString())
      .order('next_check_due_at', { ascending: true });

    if (error) {
      this.error.set(error.message);
    } else {
      this.duePlants.set((data ?? []) as Plant[]);
    }

    this.loading.set(false);
  }

  async snoozeCheck(plantId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { error } = await this.supabase.client.rpc('snooze_plant_check', {
      p_plant_id: plantId,
    });

    if (error) {
      this.error.set(error.message);
    } else {
      await this.loadDuePlants();
    }

    this.loading.set(false);
  }
}

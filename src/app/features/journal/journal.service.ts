import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import type { Database } from '../../../types/database.types';

type JournalInsert = Database['public']['Tables']['plant_journals']['Insert'];
type JournalRow = Database['public']['Tables']['plant_journals']['Row'];

export type JournalEntryWithPlant = JournalRow & {
  plants: { common_name: string; scientific_name: string | null };
};

@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly supabase = inject(SupabaseService);

  readonly entries = signal<JournalEntryWithPlant[]>([]);
  readonly loadingEntries = signal(false);
  readonly entriesError = signal<string | null>(null);

  async uploadImage(userId: string, plantId: string, blob: Blob): Promise<string> {
    const path = `${userId}/${plantId}/${Date.now()}.jpg`;

    const { error } = await this.supabase.client.storage
      .from('plant-journal-images')
      .upload(path, blob, { contentType: 'image/jpeg' });

    if (error) throw error;
    return path;
  }

  async createEntry(payload: JournalInsert): Promise<JournalRow> {
    const { data, error } = await this.supabase.client
      .from('plant_journals')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async loadEntries(): Promise<void> {
    this.loadingEntries.set(true);
    this.entriesError.set(null);

    const { data, error } = await this.supabase.client
      .from('plant_journals')
      .select('*, plants(common_name, scientific_name)')
      .order('logged_at', { ascending: false });

    if (error) {
      this.entriesError.set('Failed to load journal entries — check your connection and refresh.');
      this.loadingEntries.set(false);
      return;
    }

    this.entries.set((data ?? []) as JournalEntryWithPlant[]);
    this.loadingEntries.set(false);
  }

  async logWatering(plantId: string, notes: string): Promise<void> {
    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();
    if (!user) return;
    await this.createEntry({
      plant_id: plantId,
      user_id: user.id,
      category: 'Watering',
      notes: notes.trim() || null,
      logged_at: new Date().toISOString(),
    });
  }

  getPublicUrl(path: string): string {
    return this.supabase.client.storage.from('plant-journal-images').getPublicUrl(path).data
      .publicUrl;
  }
}

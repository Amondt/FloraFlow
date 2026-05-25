import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import type { Database } from '../../../types/database.types';

type JournalInsert = Database['public']['Tables']['plant_journals']['Insert'];
type JournalRow = Database['public']['Tables']['plant_journals']['Row'];

@Injectable({ providedIn: 'root' })
export class JournalService {
  private readonly supabase = inject(SupabaseService);

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
}

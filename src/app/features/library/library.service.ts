import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import type { Database } from '../../../types/database.types';
import { BotanicalSearchService } from '../../core/services/botanical-search.service';

export type CachedBotanicalRecord = Database['public']['Tables']['cached_botanical_records']['Row'];

export interface LibraryFilters {
  watering?: string;
  sunlight?: string;
  is_toxic_to_pets?: boolean | null;
  cycle?: string;
  phMin?: number;
  phMax?: number;
}

export const WATERING_OPTIONS = ['Frequent', 'Average', 'Minimum', 'None'] as const;
export const SUNLIGHT_OPTIONS = ['full sun', 'part shade', 'full shade'] as const;
export const CYCLE_OPTIONS = ['Perennial', 'Annual', 'Biennial', 'Biannual'] as const;

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly supabase = inject(SupabaseService);
  private readonly botanicalSearch = inject(BotanicalSearchService);

  async browse(filters: LibraryFilters): Promise<CachedBotanicalRecord[]> {
    try {
      let query = this.supabase.client.from('cached_botanical_records').select('*');

      if (filters.watering != null) query = query.eq('watering', filters.watering);
      if (filters.sunlight != null) query = query.contains('sunlight', [filters.sunlight]);
      if (filters.is_toxic_to_pets != null)
        query = query.eq('is_toxic_to_pets', filters.is_toxic_to_pets);
      if (filters.cycle != null) query = query.eq('cycle', filters.cycle);
      if (filters.phMin != null && filters.phMax != null)
        query = query.lte('ideal_min_ph', filters.phMax).gte('ideal_max_ph', filters.phMin);

      const { data, error } = await query.order('cached_at', { ascending: false }).limit(50);

      if (error) return [];
      return data ?? [];
    } catch {
      return [];
    }
  }

  async search(searchQuery: string, filters: LibraryFilters): Promise<CachedBotanicalRecord[]> {
    try {
      const suggestions = await this.botanicalSearch.search(searchQuery);
      const names = suggestions.map((s) => s.scientific_name);
      if (names.length === 0) return [];

      let query = this.supabase.client
        .from('cached_botanical_records')
        .select('*')
        .in('scientific_name', names);

      if (filters.watering != null) query = query.eq('watering', filters.watering);
      if (filters.sunlight != null) query = query.contains('sunlight', [filters.sunlight]);
      if (filters.is_toxic_to_pets != null)
        query = query.eq('is_toxic_to_pets', filters.is_toxic_to_pets);
      if (filters.cycle != null) query = query.eq('cycle', filters.cycle);
      if (filters.phMin != null && filters.phMax != null)
        query = query.lte('ideal_min_ph', filters.phMax).gte('ideal_max_ph', filters.phMin);

      const { data, error } = await query.order('cached_at', { ascending: false }).limit(50);

      if (error) return [];
      return data ?? [];
    } catch {
      return [];
    }
  }
}

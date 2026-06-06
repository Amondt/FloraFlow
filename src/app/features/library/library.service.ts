import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import type { Database } from '../../../types/database.types';
import { BotanicalSearchService } from '../../core/services/botanical-search.service';
import { environment } from '../../../environments/environment';

export type CachedBotanicalRecord = Database['public']['Tables']['cached_botanical_records']['Row'];

export interface LibraryPage {
  data: CachedBotanicalRecord[];
  count: number;
}

export interface LibraryFilters {
  watering?: string;
  sunlight?: string;
  isPetSafe?: boolean;
  cycle?: string;
  phMin?: number;
  phMax?: number;
  placement?: string;
  careDifficulty?: string[];
  maintenanceLevel?: string[];
  isTropical?: boolean;
  airPurifying?: boolean;
  isSafeForHumans?: boolean;
}

export const PAGE_SIZE = 20;
export const WATERING_OPTIONS = ['Frequent', 'Average', 'Minimum', 'None'] as const;
export const SUNLIGHT_OPTIONS = [
  'full_sun',
  'part_shade',
  'full_shade',
  'filtered_indirect',
] as const;
export const CYCLE_OPTIONS = ['Perennial', 'Annual', 'Biennial'] as const;
export const PLACEMENT_OPTIONS = ['Indoor', 'Outdoor', 'Both'] as const;
export const CARE_DIFFICULTY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'] as const;
export const MAINTENANCE_OPTIONS = ['Low', 'Medium', 'High'] as const;

export { SUNLIGHT_LABEL, WATERING_LABEL } from '../../shared/utils/botanical-label.util';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly supabase = inject(SupabaseService);
  private readonly botanicalSearch = inject(BotanicalSearchService);

  async browse(filters: LibraryFilters, page = 0, pageSize = PAGE_SIZE): Promise<LibraryPage> {
    try {
      let query = this.supabase.client
        .from('cached_botanical_records')
        .select('*', { count: 'exact' });

      if (filters.watering != null) query = query.eq('watering', filters.watering);
      if (filters.sunlight != null) query = query.contains('sunlight', [filters.sunlight]);
      if (filters.isPetSafe === true) query = query.eq('is_toxic_to_pets', false);
      if (filters.cycle != null)
        query = query.in(
          'cycle',
          filters.cycle === 'Biennial' ? ['Biennial', 'Biannual'] : [filters.cycle],
        );
      if (filters.phMin != null && filters.phMax != null)
        query = query.lte('ideal_min_ph', filters.phMax).gte('ideal_max_ph', filters.phMin);
      if (filters.placement != null) {
        if (filters.placement === 'Indoor') query = query.in('placement', ['Indoor', 'Both']);
        else if (filters.placement === 'Outdoor')
          query = query.in('placement', ['Outdoor', 'Both']);
        else query = query.eq('placement', 'Both');
      }
      if (filters.careDifficulty?.length)
        query = query.in('care_difficulty', filters.careDifficulty);
      if (filters.maintenanceLevel?.length)
        query = query.in('maintenance_level', filters.maintenanceLevel);
      if (filters.isTropical === true) query = query.eq('is_tropical', true);
      if (filters.airPurifying === true) query = query.eq('air_purifying', true);
      if (filters.isSafeForHumans === true) query = query.eq('is_toxic_to_humans', false);

      const from = page * pageSize;
      const { data, count, error } = await query
        .order('cached_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) return { data: [], count: 0 };
      return { data: data ?? [], count: count ?? 0 };
    } catch {
      return { data: [], count: 0 };
    }
  }

  async refetchByScientificNames(names: string[]): Promise<CachedBotanicalRecord[]> {
    if (names.length === 0) return [];
    try {
      const { data, error } = await this.supabase.client
        .from('cached_botanical_records')
        .select('*')
        .in('scientific_name', names);
      if (error) return [];
      return data ?? [];
    } catch {
      return [];
    }
  }

  async fetchByScientificName(name: string): Promise<CachedBotanicalRecord | null> {
    try {
      const { data, error } = await this.supabase.client
        .from('cached_botanical_records')
        .select('*')
        .eq('scientific_name', name)
        .maybeSingle();
      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }

  async triggerEnrichment(
    records: Array<Pick<CachedBotanicalRecord, 'scientific_name' | 'common_name'>>,
    signal?: AbortSignal,
  ): Promise<void> {
    if (records.length === 0) return;
    const token = await this.supabase.getAuthToken();
    if (!token) return;

    const url = `${environment.supabaseUrl}/functions/v1/claude-enrichment`;
    const BATCH = 3;
    for (let i = 0; i < records.length; i += BATCH) {
      if (signal?.aborted) return;
      for (const r of records.slice(i, i + BATCH)) {
        void fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ scientificName: r.scientific_name, commonName: r.common_name }),
        }).catch(() => {});
      }
      if (i + BATCH < records.length) {
        await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async search(
    searchQuery: string,
    filters: LibraryFilters,
    page = 0,
    pageSize = PAGE_SIZE,
  ): Promise<LibraryPage> {
    try {
      // Strip PostgREST structural characters before interpolating into .or() — same
      // sanitisation the botanical-search Edge Function applies.
      const safeQ = searchQuery.trim().replace(/[,)(]/g, '');
      if (safeQ.length < 2) return { data: [], count: 0 };

      // Populate the Perenual cache for queries not yet seen. The return value is
      // intentionally discarded — the library queries the full cache with ILIKE so
      // all matching records are visible, not just the 30 the autocomplete returns.
      await this.botanicalSearch.search(safeQ);

      // ILIKE directly on the cache — no IN-list cap, all matching records surface.
      let query = this.supabase.client
        .from('cached_botanical_records')
        .select('*', { count: 'exact' })
        .or(`common_name.ilike.%${safeQ}%,scientific_name.ilike.%${safeQ}%`);

      if (filters.watering != null) query = query.eq('watering', filters.watering);
      if (filters.sunlight != null) query = query.contains('sunlight', [filters.sunlight]);
      if (filters.isPetSafe === true) query = query.eq('is_toxic_to_pets', false);
      if (filters.cycle != null)
        query = query.in(
          'cycle',
          filters.cycle === 'Biennial' ? ['Biennial', 'Biannual'] : [filters.cycle],
        );
      if (filters.phMin != null && filters.phMax != null)
        query = query.lte('ideal_min_ph', filters.phMax).gte('ideal_max_ph', filters.phMin);
      if (filters.placement != null) {
        if (filters.placement === 'Indoor') query = query.in('placement', ['Indoor', 'Both']);
        else if (filters.placement === 'Outdoor')
          query = query.in('placement', ['Outdoor', 'Both']);
        else query = query.eq('placement', 'Both');
      }
      if (filters.careDifficulty?.length)
        query = query.in('care_difficulty', filters.careDifficulty);
      if (filters.maintenanceLevel?.length)
        query = query.in('maintenance_level', filters.maintenanceLevel);
      if (filters.isTropical === true) query = query.eq('is_tropical', true);
      if (filters.airPurifying === true) query = query.eq('air_purifying', true);
      if (filters.isSafeForHumans === true) query = query.eq('is_toxic_to_humans', false);

      const from = page * pageSize;
      const { data, count, error } = await query
        .order('cached_at', { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) return { data: [], count: 0 };
      return { data: data ?? [], count: count ?? 0 };
    } catch {
      return { data: [], count: 0 };
    }
  }
}

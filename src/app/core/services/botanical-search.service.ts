import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

export interface BotanicalSuggestion {
  scientific_name: string;
  common_name: string;
  perenual_id: number | null;
}

@Injectable({ providedIn: 'root' })
export class BotanicalSearchService {
  private readonly supabase = inject(SupabaseService);

  async search(q: string): Promise<BotanicalSuggestion[]> {
    if (q.length < 2) return [];

    try {
      const token = await this.supabase.getAuthToken();
      if (!token) return [];

      const url = `${environment.supabaseUrl}/functions/v1/botanical-search?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as BotanicalSuggestion[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

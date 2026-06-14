import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';
import type { CachedBotanicalRecord } from '../../features/library/library.service';

const MAX_PER_TRIGGER = 10;

@Injectable({ providedIn: 'root' })
export class BotanicalTranslationService {
  private readonly supabase = inject(SupabaseService);

  async triggerBotanicalTranslation(
    records: Array<Pick<CachedBotanicalRecord, 'scientific_name'>>,
    locale: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (records.length === 0 || locale === 'en') return;
    const token = await this.supabase.getAuthToken();
    if (!token) return;

    const url = `${environment.supabaseUrl}/functions/v1/translate-botanical-record`;
    const toTranslate = records.slice(0, MAX_PER_TRIGGER);

    for (let i = 0; i < toTranslate.length; i++) {
      if (signal?.aborted) return;
      void fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scientificName: toTranslate[i].scientific_name, locale }),
      }).catch(() => {});
      if (i < toTranslate.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 800));
      }
    }
  }
}

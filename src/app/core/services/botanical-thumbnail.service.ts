import { Injectable, inject, signal, untracked } from '@angular/core';
import { LibraryService, CachedBotanicalRecord } from '../../features/library/library.service';

@Injectable({ providedIn: 'root' })
export class BotanicalThumbnailService {
  private readonly libraryService = inject(LibraryService);
  private readonly _map = signal<Map<string, CachedBotanicalRecord>>(new Map());

  thumbnailFor(scientificName: string | null): string | null {
    if (!scientificName) return null;
    return this._map().get(scientificName)?.thumbnail_url ?? null;
  }

  async loadFor(plants: { scientific_name: string | null }[]): Promise<void> {
    const names = [
      ...new Set(plants.map((p) => p.scientific_name).filter((n): n is string => n !== null)),
    ];
    const toFetch = names.filter((n) => !untracked(() => this._map()).has(n));
    if (toFetch.length === 0) return;
    const records = await this.libraryService.refetchByScientificNames(toFetch);
    this._map.update((map) => {
      const updated = new Map(map);
      for (const record of records) updated.set(record.scientific_name, record);
      return updated;
    });
  }
}

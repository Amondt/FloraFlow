import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { PlantService } from '../../features/tasks/plant.service';
import { LibraryService } from '../../features/library/library.service';

@Injectable({ providedIn: 'root' })
export class PlantThumbnailService {
  private readonly plantService = inject(PlantService);
  private readonly libraryService = inject(LibraryService);

  readonly thumbnailMap = signal<Map<string, string | null>>(new Map());

  constructor() {
    effect(() => {
      const names = [
        ...new Set(
          this.plantService
            .plants()
            .map((p) => p.scientific_name)
            .filter((n): n is string => n !== null),
        ),
      ];
      if (names.length > 0) {
        void this._load(names);
      }
    });
  }

  private async _load(names: string[]): Promise<void> {
    const toFetch = names.filter((n) => !untracked(() => this.thumbnailMap()).has(n));
    if (toFetch.length === 0) return;
    const records = await this.libraryService.refetchByScientificNames(toFetch);
    this.thumbnailMap.update((map) => {
      const updated = new Map(map);
      for (const r of records) {
        updated.set(r.scientific_name, r.thumbnail_url ?? null);
      }
      for (const name of toFetch) {
        if (!updated.has(name)) updated.set(name, null);
      }
      return updated;
    });
  }
}

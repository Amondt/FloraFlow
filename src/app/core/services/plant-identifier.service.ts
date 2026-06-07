import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ImageCompressorService } from './image-compressor.service';
import { SupabaseService } from './supabase.service';
import { environment } from '../../../environments/environment';
import type { Database } from '../../../types/database.types';

export type BotanicalCacheRow = Database['public']['Tables']['cached_botanical_records']['Row'];

export interface PlantIdCandidate {
  common_name: string;
  scientific_name: string;
  confidence_score: number;
}

export interface PlantIdResult {
  is_plant_image: true;
  species_match: PlantIdCandidate;
  alternative_candidates: PlantIdCandidate[];
  perenual_id: number | null;
}

export class InvalidPlantImageError extends Error {
  override name = 'InvalidPlantImageError';
  constructor() {
    super('Image does not appear to show a plant.');
  }
}

@Injectable({ providedIn: 'root' })
export class PlantIdentifierService {
  private readonly http = inject(HttpClient);
  private readonly supabase = inject(SupabaseService);
  private readonly compressor = inject(ImageCompressorService);

  async identify(file: File): Promise<PlantIdResult> {
    const blob = await this.compressor.compress(file);

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const token = await this.supabase.getAuthToken();

    try {
      return await firstValueFrom(
        this.http.post<PlantIdResult>(
          `${environment.supabaseUrl}/functions/v1/claude-plant-id`,
          { imageBase64: base64, imageMediaType: 'image/jpeg' },
          {
            headers: {
              Authorization: `Bearer ${token ?? ''}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 400) {
        const body = err.error as { error_code?: string };
        if (body?.error_code === 'INVALID_IMAGE') {
          throw new InvalidPlantImageError();
        }
      }
      throw err;
    }
  }

  async fetchCandidateRecords(
    scientificNames: string[],
  ): Promise<Map<string, BotanicalCacheRow | null>> {
    const { data } = await this.supabase.client
      .from('cached_botanical_records')
      .select('*')
      .in('scientific_name', scientificNames);
    const map = new Map<string, BotanicalCacheRow | null>(scientificNames.map((n) => [n, null]));
    data?.forEach((r) => map.set(r.scientific_name, r));
    return map;
  }
}

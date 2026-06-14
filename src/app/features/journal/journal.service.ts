import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { environment } from '../../../environments/environment';
import type { Database } from '../../../types/database.types';

type JournalInsert = Database['public']['Tables']['plant_journals']['Insert'];
type JournalRow = Database['public']['Tables']['plant_journals']['Row'];
type JournalUpdate = Database['public']['Tables']['plant_journals']['Update'];

export interface LeafDoctorDiagnostics {
  primary_condition: string;
  confidence_score: number;
  immediate_remedial_actions: string[];
  systemic_risk_assessment: 'Isolated' | 'ZoneContagious' | 'FatalThreat';
  /** Set when the photo showed a different species than the selected plant. */
  species_mismatch_name?: string | null;
}

export interface HealthyDiagnosticsBlob {
  is_healthy: true;
  identified_plant: string | null;
}

export interface LeafDoctorResult {
  is_botanical_image: boolean;
  error_message: string | null;
  is_healthy: boolean;
  identified_plant: string | null;
  species_matches_context: boolean | null;
  diagnostics: LeafDoctorDiagnostics | null;
}

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

  async updateEntry(id: string, payload: JournalUpdate): Promise<void> {
    const { error } = await this.supabase.client
      .from('plant_journals')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
  }

  async deleteEntry(id: string): Promise<void> {
    const { error } = await this.supabase.client.from('plant_journals').delete().eq('id', id);

    if (error) throw error;
  }

  async loadEntries(): Promise<void> {
    this.loadingEntries.set(true);
    this.entriesError.set(null);

    const { data, error } = await this.supabase.client
      .from('plant_journals')
      .select('*, plants(common_name, scientific_name)')
      .order('logged_at', { ascending: false });

    if (error) {
      this.entriesError.set(error.message);
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

  async translateDiagnostics(entryId: string, diagnostics: object, locale: string): Promise<void> {
    const token = await this.supabase.getAuthToken();
    if (!token) return;

    const d = diagnostics as Record<string, unknown>;
    const fields: Record<string, string | string[]> = {};

    if (typeof d['primary_condition'] === 'string' && d['primary_condition'].length > 0) {
      fields['primary_condition'] = d['primary_condition'];
    }
    if (typeof d['identified_plant'] === 'string' && d['identified_plant'].length > 0) {
      fields['identified_plant'] = d['identified_plant'];
    }
    if (
      Array.isArray(d['immediate_remedial_actions']) &&
      d['immediate_remedial_actions'].length > 0
    ) {
      fields['immediate_remedial_actions'] = d['immediate_remedial_actions'] as string[];
    }

    if (Object.keys(fields).length === 0) return;

    const url = `${environment.supabaseUrl}/functions/v1/translate-text`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields, locale }),
    });
    if (!response.ok) return;

    const { translations } = (await response.json()) as { translations: Record<string, unknown> };

    const entry = this.entries().find((e) => e.id === entryId);
    const existing = (entry?.diagnostics_i18n ?? {}) as Record<string, unknown>;
    const updatedI18n = { ...existing, [locale]: translations };

    const { error } = await this.supabase.client
      .from('plant_journals')
      .update({ diagnostics_i18n: updatedI18n })
      .eq('id', entryId);

    if (error) return;

    this.entries.update((list) =>
      list.map((e) =>
        e.id === entryId
          ? { ...e, diagnostics_i18n: updatedI18n as JournalRow['diagnostics_i18n'] }
          : e,
      ),
    );
  }
}

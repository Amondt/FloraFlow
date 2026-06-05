import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { SeedBatch, SeedBatchFormData, SEED_STAGE_OPTIONS } from './seed-batch.model';

@Injectable({ providedIn: 'root' })
export class SeedBatchService {
  private readonly supabase = inject(SupabaseService);

  readonly batches = signal<SeedBatch[]>([]);
  readonly archivedBatches = signal<SeedBatch[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadBatches(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('seed_batches')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      this.error.set(error.message);
    } else {
      this.batches.set((data ?? []) as SeedBatch[]);
    }

    this.loading.set(false);
  }

  async createBatch(data: SeedBatchFormData): Promise<SeedBatch | null> {
    this.error.set(null);

    const {
      data: { user },
    } = await this.supabase.client.auth.getUser();

    if (!user) {
      this.error.set('Not authenticated.');
      return null;
    }

    const { data: inserted, error } = await this.supabase.client
      .from('seed_batches')
      .insert({ ...data, user_id: user.id })
      .select('*')
      .single();

    if (error) {
      this.error.set(error.message);
      return null;
    }

    const batch = inserted as SeedBatch;
    this.batches.update((all) => [batch, ...all]);
    return batch;
  }

  async updateBatch(id: string, data: SeedBatchFormData): Promise<void> {
    this.error.set(null);

    const { error } = await this.supabase.client.from('seed_batches').update(data).eq('id', id);

    if (error) {
      this.error.set(error.message);
      return;
    }

    await this._refreshBatch(id);
  }

  async deleteBatch(id: string): Promise<void> {
    this.error.set(null);

    const { error } = await this.supabase.client.from('seed_batches').delete().eq('id', id);

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.batches.update((all) => all.filter((b) => b.id !== id));
  }

  /** Removes the batch from the appropriate signal immediately, with no DB call.
   *  Call this before scheduling a deferred delete or archive so the UI reacts instantly. */
  optimisticallyRemoveBatch(batch: SeedBatch): void {
    if (batch.archived_at) {
      this.archivedBatches.update((all) => all.filter((b) => b.id !== batch.id));
    } else {
      this.batches.update((all) => all.filter((b) => b.id !== batch.id));
    }
  }

  /** Prepends a previously removed batch back to the correct signal.
   *  Call this when the user clicks Undo on a delete or archive toast. */
  restoreBatch(batch: SeedBatch): void {
    if (batch.archived_at) {
      this.archivedBatches.update((all) => [batch, ...all]);
    } else {
      this.batches.update((all) => [batch, ...all]);
    }
  }

  async unarchiveBatch(id: string): Promise<void> {
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('seed_batches')
      .update({ archived_at: null })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.archivedBatches.update((all) => all.filter((b) => b.id !== id));
    if (data) {
      this.batches.update((all) => [data as SeedBatch, ...all]);
    }
  }

  async loadArchivedBatches(): Promise<void> {
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('seed_batches')
      .select('*')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });

    if (error) {
      this.error.set(error.message);
    } else {
      this.archivedBatches.set((data ?? []) as SeedBatch[]);
    }
  }

  async archiveBatch(id: string): Promise<void> {
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('seed_batches')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.batches.update((all) => all.filter((b) => b.id !== id));
    if (data) {
      this.archivedBatches.update((all) => [data as SeedBatch, ...all]);
    }
  }

  async advanceStage(batch: SeedBatch): Promise<void> {
    const currentIndex = SEED_STAGE_OPTIONS.indexOf(batch.current_stage);
    if (currentIndex === SEED_STAGE_OPTIONS.length - 1) return;

    const nextStage = SEED_STAGE_OPTIONS[currentIndex + 1];

    const payload: {
      current_stage: typeof nextStage;
      sown_at?: string;
      germinated_at?: string;
    } = { current_stage: nextStage };

    if (nextStage === 'Sown Indoors') payload.sown_at = new Date().toISOString();
    if (nextStage === 'Germinated') payload.germinated_at = new Date().toISOString();

    const { error } = await this.supabase.client
      .from('seed_batches')
      .update(payload)
      .eq('id', batch.id);

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.batches.update((all) => all.map((b) => (b.id === batch.id ? { ...b, ...payload } : b)));

    if (nextStage === 'Transplanted Outside') {
      await this.archiveBatch(batch.id);
    }
  }

  private async _refreshBatch(id: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('seed_batches')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      await this.loadBatches();
    } else if (data) {
      this.batches.update((all) => all.map((b) => (b.id === id ? (data as SeedBatch) : b)));
    }
  }
}

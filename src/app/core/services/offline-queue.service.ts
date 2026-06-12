import { Injectable, signal } from '@angular/core';
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export class OfflineStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfflineStorageError';
  }
}

export interface QueuedAction {
  id: string;
  action: 'confirm' | 'snooze' | 'create' | 'create-zone' | 'update-zone' | 'delete-zone';
  plant_id: string;
  snooze_days?: number;
  queued_at: string;
  common_name?: string;
  scientific_name?: string | null;
  inat_taxon_id?: number | null;
  zone_id?: string;
  container_vector?: string;
  substrate_factor?: string;
  growth_stage?: string;
  pot_diameter_cm?: number | null;
  zone_name?: string;
  zone_icon?: string;
  zone_type?: string;
  zone_window_orientation?: string;
  zone_has_active_ventilation?: boolean;
  zone_has_grow_lights?: boolean;
  zone_humidity_baseline?: number;
}

interface FloraFlowDB extends DBSchema {
  'action-queue': {
    key: string;
    value: QueuedAction;
  };
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  readonly pendingCount = signal<number>(0);

  private readonly db: Promise<IDBPDatabase<FloraFlowDB>> = openDB<FloraFlowDB>(
    'floraflow-offline',
    1,
    {
      upgrade(db) {
        if (!db.objectStoreNames.contains('action-queue')) {
          db.createObjectStore('action-queue', { keyPath: 'id' });
        }
      },
    },
  );

  async enqueue(action: QueuedAction): Promise<void> {
    try {
      const db = await this.db;
      await db.put('action-queue', action);
      await this.refreshCount();
    } catch (err) {
      throw new OfflineStorageError(`Failed to enqueue action: ${(err as Error).message}`);
    }
  }

  async getAll(): Promise<QueuedAction[]> {
    const db = await this.db;
    return db.getAll('action-queue');
  }

  async remove(id: string): Promise<void> {
    try {
      const db = await this.db;
      await db.delete('action-queue', id);
      await this.refreshCount();
    } catch (err) {
      throw new OfflineStorageError(`Failed to remove action ${id}: ${(err as Error).message}`);
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.db;
      await db.clear('action-queue');
      await this.refreshCount();
    } catch (err) {
      throw new OfflineStorageError(`Failed to clear queue: ${(err as Error).message}`);
    }
  }

  private async refreshCount(): Promise<void> {
    const db = await this.db;
    const count = await db.count('action-queue');
    this.pendingCount.set(count);
  }
}

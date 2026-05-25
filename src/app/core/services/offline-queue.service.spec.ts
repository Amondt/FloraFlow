import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('idb', () => ({ openDB: vi.fn() }));

import { TestBed } from '@angular/core/testing';
import { openDB } from 'idb';
import { OfflineQueueService, type QueuedAction } from './offline-queue.service';

function makeFakeDB() {
  const store = new Map<string, QueuedAction>();
  return {
    put: (_storeName: string, value: QueuedAction) => {
      store.set(value.id, value);
      return Promise.resolve(value.id);
    },
    getAll: () => Promise.resolve([...store.values()]),
    delete: (_storeName: string, key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
    clear: () => {
      store.clear();
      return Promise.resolve();
    },
    count: () => Promise.resolve(store.size),
    objectStoreNames: { contains: () => true },
  };
}

function makeItem(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: crypto.randomUUID(),
    action: 'confirm',
    plant_id: 'plant-1',
    queued_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;

  beforeEach(async () => {
    const fakeDB = makeFakeDB();
    vi.mocked(openDB).mockResolvedValue(fakeDB as never);

    await TestBed.configureTestingModule({
      providers: [OfflineQueueService],
    }).compileComponents();

    service = TestBed.inject(OfflineQueueService);
  });

  it('starts with pendingCount of 0', () => {
    expect(service.pendingCount()).toBe(0);
  });

  describe('enqueue()', () => {
    it('makes the item retrievable via getAll()', async () => {
      const item = makeItem({ id: 'a1' });
      await service.enqueue(item);

      const all = await service.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('a1');
    });

    it('increments pendingCount after each enqueue', async () => {
      await service.enqueue(makeItem({ id: 'b1' }));
      expect(service.pendingCount()).toBe(1);

      await service.enqueue(makeItem({ id: 'b2' }));
      expect(service.pendingCount()).toBe(2);
    });

    it('stores multiple items and returns all of them', async () => {
      await service.enqueue(makeItem({ id: 'c1', action: 'confirm' }));
      await service.enqueue(makeItem({ id: 'c2', action: 'snooze' }));

      const all = await service.getAll();
      expect(all).toHaveLength(2);
      const ids = all.map((i) => i.id);
      expect(ids).toContain('c1');
      expect(ids).toContain('c2');
    });
  });

  describe('remove()', () => {
    it('removes the item and decrements pendingCount', async () => {
      await service.enqueue(makeItem({ id: 'd1' }));
      await service.enqueue(makeItem({ id: 'd2' }));

      await service.remove('d1');

      const all = await service.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('d2');
      expect(service.pendingCount()).toBe(1);
    });

    it('leaves other items untouched when removing one', async () => {
      await service.enqueue(makeItem({ id: 'e1' }));
      await service.enqueue(makeItem({ id: 'e2' }));
      await service.enqueue(makeItem({ id: 'e3' }));

      await service.remove('e2');

      const all = await service.getAll();
      expect(all.map((i) => i.id)).toEqual(expect.arrayContaining(['e1', 'e3']));
      expect(all.find((i) => i.id === 'e2')).toBeUndefined();
    });
  });

  describe('clear()', () => {
    it('empties the queue and resets pendingCount to 0', async () => {
      await service.enqueue(makeItem({ id: 'f1' }));
      await service.enqueue(makeItem({ id: 'f2' }));

      await service.clear();

      expect(await service.getAll()).toHaveLength(0);
      expect(service.pendingCount()).toBe(0);
    });
  });
});

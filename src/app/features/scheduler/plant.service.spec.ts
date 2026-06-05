import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PlantService } from './plant.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { SupabaseService } from '../../core/services/supabase.service';
import type { QueuedAction } from '../../core/services/offline-queue.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function makeItem(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: crypto.randomUUID(),
    action: 'confirm',
    plant_id: 'plant-1',
    queued_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('PlantService — reconciliation loop', () => {
  let service: PlantService;
  let isOnline: ReturnType<typeof signal<boolean>>;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockRemove: ReturnType<typeof vi.fn>;
  let mockRpc: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    isOnline = signal(false);
    mockGetAll = vi.fn().mockResolvedValue([]);
    mockRemove = vi.fn().mockResolvedValue(undefined);
    mockRpc = vi.fn().mockResolvedValue({ error: null });

    await TestBed.configureTestingModule({
      providers: [
        PlantService,
        { provide: NetworkStatusService, useValue: { isOnline } },
        {
          provide: OfflineQueueService,
          useValue: {
            getAll: mockGetAll,
            remove: mockRemove,
            pendingCount: signal(0),
            enqueue: vi.fn(),
            clear: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              rpc: mockRpc,
              from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            },
          },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(PlantService);
  });

  it('does not call rpc or remove when the queue is empty', async () => {
    mockGetAll.mockResolvedValue([]);

    isOnline.set(true);
    TestBed.flushEffects();
    await flushPromises();

    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
    expect(service.isSyncing()).toBe(false);
  });

  it('replays a confirm action and removes it on success', async () => {
    const item = makeItem({ id: 'confirm-1', action: 'confirm', plant_id: 'plant-a' });
    mockGetAll.mockResolvedValue([item]);
    mockRpc.mockResolvedValue({ error: null });

    isOnline.set(true);
    TestBed.flushEffects();
    await flushPromises();

    expect(mockRpc).toHaveBeenCalledWith('confirm_plant_check', {
      p_plant_id: 'plant-a',
      p_snooze_days: 5,
    });
    expect(mockRemove).toHaveBeenCalledWith('confirm-1');
    expect(service.isSyncing()).toBe(false);
  });

  it('replays a snooze action and removes it on success', async () => {
    const item = makeItem({
      id: 'snooze-1',
      action: 'snooze',
      plant_id: 'plant-b',
      snooze_days: 5,
    });
    mockGetAll.mockResolvedValue([item]);
    mockRpc.mockResolvedValue({ error: null });

    isOnline.set(true);
    TestBed.flushEffects();
    await flushPromises();

    expect(mockRpc).toHaveBeenCalledWith('snooze_plant_check', {
      p_plant_id: 'plant-b',
      p_snooze_days: 5,
    });
    expect(mockRemove).toHaveBeenCalledWith('snooze-1');
  });

  it('leaves an item in the queue when its RPC returns an error', async () => {
    const item = makeItem({ id: 'fail-1', action: 'confirm', plant_id: 'plant-c' });
    mockGetAll.mockResolvedValue([item]);
    mockRpc.mockResolvedValue({ error: { message: 'RPC failed' } });

    isOnline.set(true);
    TestBed.flushEffects();
    await flushPromises();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(service.isSyncing()).toBe(false);
  });

  it('continues processing subsequent items after a partial failure', async () => {
    const failItem = makeItem({ id: 'fail', plant_id: 'plant-x' });
    const okItem = makeItem({ id: 'ok', plant_id: 'plant-y' });
    mockGetAll.mockResolvedValue([failItem, okItem]);
    mockRpc
      .mockResolvedValueOnce({ error: { message: 'first fails' } })
      .mockResolvedValueOnce({ error: null });

    isOnline.set(true);
    TestBed.flushEffects();
    await flushPromises();

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith('ok');
    expect(mockRemove).not.toHaveBeenCalledWith('fail');
  });
});

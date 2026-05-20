import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ZoneService } from './zone.service';
import { NetworkStatusService } from '../../core/services/network-status.service';
import { OfflineQueueService } from '../../core/services/offline-queue.service';
import { SupabaseService } from '../../core/services/supabase.service';
import type { ZoneFormData } from './zone.model';
import type { QueuedAction } from '../../core/services/offline-queue.service';

const flushPromises = () => new Promise<void>(resolve => setTimeout(resolve, 0));

const FORM_DATA: ZoneFormData = {
  name: 'Living Room',
  icon: '🪴',
  window_orientation: 'South',
  has_active_ventilation: false,
  has_grow_lights: true,
  humidity_baseline: 55,
};

function makeZoneItem(overrides: Partial<QueuedAction> = {}): QueuedAction {
  return {
    id: crypto.randomUUID(),
    action: 'create-zone',
    plant_id: 'zone-1',
    queued_at: new Date().toISOString(),
    zone_name: 'Living Room',
    zone_icon: '🪴',
    zone_window_orientation: 'South',
    zone_has_active_ventilation: false,
    zone_has_grow_lights: true,
    zone_humidity_baseline: 55,
    ...overrides,
  };
}

function makeFromMock(insertResult: { error: { message: string } | null } = { error: null }) {
  const mockOrder  = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
  const mockInsert = vi.fn().mockResolvedValue(insertResult);
  const mockEqUpd  = vi.fn().mockResolvedValue({ error: null });
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEqUpd });
  const mockEqDel  = vi.fn().mockResolvedValue({ error: null });
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEqDel });
  return vi.fn().mockReturnValue({ select: mockSelect, insert: mockInsert, update: mockUpdate, delete: mockDelete });
}

describe('ZoneService', () => {
  let service: ZoneService;
  let isOnline: ReturnType<typeof signal<boolean>>;
  let mockGetAll: ReturnType<typeof vi.fn>;
  let mockRemove: ReturnType<typeof vi.fn>;
  let mockEnqueue: ReturnType<typeof vi.fn>;
  let mockFrom: ReturnType<typeof vi.fn>;
  let mockGetUser: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    isOnline    = signal(false);
    mockGetAll  = vi.fn().mockResolvedValue([]);
    mockRemove  = vi.fn().mockResolvedValue(undefined);
    mockEnqueue = vi.fn().mockResolvedValue(undefined);
    mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockFrom    = makeFromMock();

    await TestBed.configureTestingModule({
      providers: [
        ZoneService,
        { provide: NetworkStatusService, useValue: { isOnline } },
        {
          provide: OfflineQueueService,
          useValue: {
            getAll: mockGetAll,
            remove: mockRemove,
            enqueue: mockEnqueue,
            pendingCount: signal(0),
            clear: vi.fn(),
          },
        },
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: mockFrom,
              auth: { getUser: mockGetUser },
            },
          },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(ZoneService);
  });

  describe('loadZones()', () => {
    it('populates zones signal on success', async () => {
      const zone = { id: 'z1', user_id: 'user-123', ...FORM_DATA, created_at: '', updated_at: '' };
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [zone], error: null }),
        }),
      });

      await service.loadZones();

      expect(service.zones()).toHaveLength(1);
      expect(service.zones()[0].name).toBe('Living Room');
      expect(service.loading()).toBe(false);
    });

    it('sets error signal when DB returns an error', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB down' } }),
        }),
      });

      await service.loadZones();

      expect(service.error()).toBe('DB down');
      expect(service.zones()).toHaveLength(0);
      expect(service.loading()).toBe(false);
    });

    it('skips DB call when offline with a populated cache', async () => {
      service.zones.set([{ id: 'z1', user_id: 'u', ...FORM_DATA, created_at: '', updated_at: '' }]);

      await service.loadZones();

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('createZone() — offline', () => {
    it('adds an optimistic zone with the offline- prefix', async () => {
      await service.createZone(FORM_DATA);

      expect(service.zones()).toHaveLength(1);
      expect(service.zones()[0].id).toMatch(/^offline-zone-/);
      expect(service.zones()[0].name).toBe('Living Room');
    });

    it('enqueues a create-zone action with the correct payload', async () => {
      await service.createZone(FORM_DATA);

      expect(mockEnqueue).toHaveBeenCalledOnce();
      const arg = mockEnqueue.mock.calls[0][0] as QueuedAction;
      expect(arg.action).toBe('create-zone');
      expect(arg.zone_name).toBe('Living Room');
      expect(arg.zone_window_orientation).toBe('South');
    });

    it('does not call Supabase when offline', async () => {
      await service.createZone(FORM_DATA);

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('createZone() — online', () => {
    beforeEach(() => { isOnline.set(true); });

    it('calls DB insert and reloads zones on success', async () => {
      await service.createZone(FORM_DATA);

      expect(mockFrom).toHaveBeenCalledWith('zones');
      expect(service.loading()).toBe(false);
      expect(service.error()).toBeNull();
    });

    it('sets error and stops when the user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      await service.createZone(FORM_DATA);

      expect(service.error()).toBe('Not authenticated.');
      expect(service.loading()).toBe(false);
    });
  });

  describe('updateZone() — offline', () => {
    it('updates the matching zone optimistically in the signal', async () => {
      service.zones.set([{ id: 'z1', user_id: 'u', ...FORM_DATA, name: 'Old Name', created_at: '', updated_at: '' }]);

      await service.updateZone('z1', { ...FORM_DATA, name: 'New Name' });

      expect(service.zones()[0].name).toBe('New Name');
    });

    it('enqueues an update-zone action referencing the correct id', async () => {
      service.zones.set([{ id: 'z1', user_id: 'u', ...FORM_DATA, created_at: '', updated_at: '' }]);

      await service.updateZone('z1', FORM_DATA);

      const arg = mockEnqueue.mock.calls[0][0] as QueuedAction;
      expect(arg.action).toBe('update-zone');
      expect(arg.plant_id).toBe('z1');
    });
  });

  describe('deleteZone() — offline', () => {
    it('removes the zone from the signal immediately', async () => {
      service.zones.set([{ id: 'z1', user_id: 'u', ...FORM_DATA, created_at: '', updated_at: '' }]);

      await service.deleteZone('z1');

      expect(service.zones()).toHaveLength(0);
    });

    it('enqueues a delete-zone action referencing the correct id', async () => {
      service.zones.set([{ id: 'z1', user_id: 'u', ...FORM_DATA, created_at: '', updated_at: '' }]);

      await service.deleteZone('z1');

      const arg = mockEnqueue.mock.calls[0][0] as QueuedAction;
      expect(arg.action).toBe('delete-zone');
      expect(arg.plant_id).toBe('z1');
    });
  });

  describe('reconciliation loop', () => {
    it('does not call from() when the queue is empty on reconnect', async () => {
      mockGetAll.mockResolvedValue([]);

      isOnline.set(true);
      TestBed.flushEffects();
      await flushPromises();

      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('removes a create-zone item from the queue on success', async () => {
      const item = makeZoneItem({ id: 'cz-1', action: 'create-zone' });
      mockGetAll.mockResolvedValue([item]);

      isOnline.set(true);
      TestBed.flushEffects();
      await flushPromises();

      expect(mockRemove).toHaveBeenCalledWith('cz-1');
      expect(service.isSyncing()).toBe(false);
    });

    it('leaves a create-zone item in the queue when the DB insert fails', async () => {
      const item = makeZoneItem({ id: 'cz-fail', action: 'create-zone' });
      mockGetAll.mockResolvedValue([item]);

      const mockOrder  = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqUpd  = vi.fn().mockResolvedValue({ error: null });
      const mockEqDel  = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        select: mockSelect,
        insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }),
        update: vi.fn().mockReturnValue({ eq: mockEqUpd }),
        delete: vi.fn().mockReturnValue({ eq: mockEqDel }),
      });

      isOnline.set(true);
      TestBed.flushEffects();
      await flushPromises();

      expect(mockRemove).not.toHaveBeenCalled();
      expect(service.isSyncing()).toBe(false);
    });

    it('processes delete-zone items and removes them on success', async () => {
      const item = makeZoneItem({ id: 'dz-1', action: 'delete-zone', plant_id: 'zone-abc' });
      mockGetAll.mockResolvedValue([item]);

      isOnline.set(true);
      TestBed.flushEffects();
      await flushPromises();

      expect(mockRemove).toHaveBeenCalledWith('dz-1');
    });
  });
});

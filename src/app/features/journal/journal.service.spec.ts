import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JournalService } from './journal.service';
import { SupabaseService } from '../../core/services/supabase.service';
import type { Database } from '../../../types/database.types';

type JournalInsert = Database['public']['Tables']['plant_journals']['Insert'];
type JournalRow    = Database['public']['Tables']['plant_journals']['Row'];

const PAYLOAD: JournalInsert = {
  user_id:  'user-1',
  plant_id: 'plant-2',
  notes:    'Leaves look healthy',
};

const RETURNED_ROW: JournalRow = {
  id:                  'entry-uuid',
  user_id:             'user-1',
  plant_id:            'plant-2',
  notes:               'Leaves look healthy',
  category:            'Observation',
  image_storage_path:  null,
  logged_at:           '2024-01-01T00:00:00Z',
  created_at:          '2024-01-01T00:00:00Z',
  updated_at:          '2024-01-01T00:00:00Z',
};

describe('JournalService', () => {
  let service: JournalService;
  let mockUpload:      ReturnType<typeof vi.fn>;
  let mockStorageFrom: ReturnType<typeof vi.fn>;
  let mockSingle:      ReturnType<typeof vi.fn>;
  let mockFrom:        ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockUpload      = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom = vi.fn().mockReturnValue({ upload: mockUpload });

    mockSingle      = vi.fn().mockResolvedValue({ data: RETURNED_ROW, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    mockFrom        = vi.fn().mockReturnValue({ insert: mockInsert });

    await TestBed.configureTestingModule({
      providers: [
        JournalService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              storage: { from: mockStorageFrom },
              from: mockFrom,
            },
          },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(JournalService);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  describe('uploadImage()', () => {
    it('calls the correct bucket and builds the path as userId/plantId/timestamp.jpg', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
      const blob = new Blob(['img'], { type: 'image/jpeg' });

      const path = await service.uploadImage('user-1', 'plant-2', blob);

      expect(mockStorageFrom).toHaveBeenCalledWith('plant-journal-images');
      expect(mockUpload).toHaveBeenCalledWith(
        'user-1/plant-2/1700000000000.jpg',
        blob,
        { contentType: 'image/jpeg' },
      );
      expect(path).toBe('user-1/plant-2/1700000000000.jpg');
    });

    it('throws when the storage bucket returns an error', async () => {
      const storageError = new Error('storage quota exceeded');
      mockUpload.mockResolvedValue({ error: storageError });

      await expect(service.uploadImage('u', 'p', new Blob())).rejects.toThrow('storage quota exceeded');
    });
  });

  describe('createEntry()', () => {
    it('inserts into plant_journals and returns the echoed row', async () => {
      const result = await service.createEntry(PAYLOAD);

      expect(mockFrom).toHaveBeenCalledWith('plant_journals');
      expect(result).toEqual(RETURNED_ROW);
    });

    it('throws when the DB insert returns an error', async () => {
      mockSingle.mockResolvedValue({ data: null, error: new Error('RLS violation') });

      await expect(service.createEntry(PAYLOAD)).rejects.toThrow('RLS violation');
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SeedBatchService } from './seed-batch.service';
import { SupabaseService } from '../../core/services/supabase.service';
import type { SeedBatch } from './seed-batch.model';

function makeBatch(overrides: Partial<SeedBatch> = {}): SeedBatch {
  const now = new Date().toISOString();
  return {
    id: 'batch-1',
    user_id: 'user-1',
    common_name: 'Test Tomato',
    scientific_name: null,
    brand: null,
    packet_year: null,
    current_stage: 'Stored',
    sown_at: null,
    germinated_at: null,
    notes: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe('SeedBatchService — advanceStage()', () => {
  let service: SeedBatchService;
  let mockUpdate: ReturnType<typeof vi.fn>;
  let mockEq: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });

    await TestBed.configureTestingModule({
      providers: [
        SeedBatchService,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: vi.fn().mockReturnValue({ update: mockUpdate }),
            },
          },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(SeedBatchService);
  });

  it('returns early without calling the DB when batch is at the terminal stage', async () => {
    const batch = makeBatch({ current_stage: 'Transplanted Outside' });
    service.batches.set([batch]);

    await service.advanceStage(batch);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('advances from Stored to Sown Indoors and stamps a non-null sown_at', async () => {
    const batch = makeBatch({ current_stage: 'Stored' });
    service.batches.set([batch]);

    await service.advanceStage(batch);

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload['current_stage']).toBe('Sown Indoors');
    expect(payload['sown_at']).toBeTruthy();
    expect(service.batches()[0].current_stage).toBe('Sown Indoors');
    expect(service.batches()[0].sown_at).toBeTruthy();
  });

  it('advances from Sown Indoors to Germinated and stamps a non-null germinated_at', async () => {
    const batch = makeBatch({
      current_stage: 'Sown Indoors',
      sown_at: new Date().toISOString(),
    });
    service.batches.set([batch]);

    await service.advanceStage(batch);

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload['current_stage']).toBe('Germinated');
    expect(payload['germinated_at']).toBeTruthy();
    expect(service.batches()[0].current_stage).toBe('Germinated');
    expect(service.batches()[0].germinated_at).toBeTruthy();
  });

  it('advances from Germinated to Potted Up without adding timestamp fields to the payload', async () => {
    const sownAt = new Date().toISOString();
    const germinatedAt = new Date().toISOString();
    const batch = makeBatch({
      current_stage: 'Germinated',
      sown_at: sownAt,
      germinated_at: germinatedAt,
    });
    service.batches.set([batch]);

    await service.advanceStage(batch);

    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload['current_stage']).toBe('Potted Up');
    expect(payload['sown_at']).toBeUndefined();
    expect(payload['germinated_at']).toBeUndefined();
    expect(service.batches()[0].current_stage).toBe('Potted Up');
    expect(service.batches()[0].sown_at).toBe(sownAt);
    expect(service.batches()[0].germinated_at).toBe(germinatedAt);
  });
});

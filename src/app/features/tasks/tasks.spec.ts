import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TasksComponent } from './tasks';
import { PlantService } from './plant.service';
import { ZoneService } from '../dashboard/zone.service';
import { provideTranslocoTesting } from '../../testing/transloco-testing';
import type { Plant } from './plant.model';

// Fixed reference point: June 15 2024 at 14:00 local time
// startOfToday    = June 15 00:00 local
// startOfTomorrow = June 16 00:00 local
// startOfDay7     = June 22 00:00 local
const FIXED_NOW = new Date(2024, 5, 15, 14, 0, 0);

function localMidnight(offsetDays: number): string {
  return new Date(2024, 5, 15 + offsetDays).toISOString();
}

function makePlant(id: string, offsetDays: number): Plant {
  return {
    id,
    user_id: 'u',
    zone_id: 'z',
    common_name: `Plant ${id}`,
    scientific_name: null,
    inat_taxon_id: null,
    container_vector: 'Terracotta',
    substrate_factor: 'Standard Potting',
    growth_stage: 'Mature',
    last_checked_at: null,
    next_check_due_at: localMidnight(offsetDays),
    current_snooze_interval_days: 7,
    created_at: '',
    updated_at: '',
  };
}

describe('TasksComponent — plantsGrouped()', () => {
  let component: TasksComponent;
  let plantsSignal: ReturnType<typeof signal<Plant[]>>;

  beforeEach(async () => {
    vi.useFakeTimers({ now: FIXED_NOW.getTime() });
    plantsSignal = signal<Plant[]>([]);

    await TestBed.configureTestingModule({
      imports: [TasksComponent],
      providers: [
        ...provideTranslocoTesting(),
        {
          provide: PlantService,
          useValue: {
            plants: plantsSignal,
            loading: signal(false),
            error: signal(null),
            loadPlants: vi.fn().mockResolvedValue(undefined),
            confirmCheck: vi.fn(),
            snoozeCheck: vi.fn(),
            createPlant: vi.fn(),
            updatePlant: vi.fn(),
            deletePlant: vi.fn(),
          },
        },
        {
          provide: ZoneService,
          useValue: {
            zones: signal([]),
            loading: signal(false),
            error: signal(null),
            loadZones: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideTemplate(TasksComponent, '')
      .compileComponents();

    component = TestBed.createComponent(TasksComponent).componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('places a plant due yesterday in overdue', () => {
    plantsSignal.set([makePlant('p-overdue', -1)]);

    const g = component.plantsGrouped();
    expect(g.overdue.map((p) => p.id)).toContain('p-overdue');
    expect(g.today).toHaveLength(0);
    expect(g.soon).toHaveLength(0);
    expect(g.upcoming).toHaveLength(0);
  });

  it('places a plant due today (midnight) in today', () => {
    plantsSignal.set([makePlant('p-today', 0)]);

    const g = component.plantsGrouped();
    expect(g.today.map((p) => p.id)).toContain('p-today');
    expect(g.overdue).toHaveLength(0);
    expect(g.soon).toHaveLength(0);
    expect(g.upcoming).toHaveLength(0);
  });

  it('places a plant due tomorrow (midnight) in soon', () => {
    plantsSignal.set([makePlant('p-tomorrow', 1)]);

    const g = component.plantsGrouped();
    expect(g.soon.map((p) => p.id)).toContain('p-tomorrow');
    expect(g.overdue).toHaveLength(0);
    expect(g.today).toHaveLength(0);
    expect(g.upcoming).toHaveLength(0);
  });

  it('places a plant due in 7 days in soon (last day of the soon window)', () => {
    plantsSignal.set([makePlant('p-7days', 7)]);

    const g = component.plantsGrouped();
    expect(g.soon.map((p) => p.id)).toContain('p-7days');
    expect(g.upcoming).toHaveLength(0);
  });

  it('places a plant due in exactly 8 days in upcoming', () => {
    plantsSignal.set([makePlant('p-8days', 8)]);

    const g = component.plantsGrouped();
    expect(g.upcoming.map((p) => p.id)).toContain('p-8days');
    expect(g.soon).toHaveLength(0);
  });

  it('excludes plants whose id is in pendingDeleteIds from all groups', () => {
    plantsSignal.set([makePlant('p-deleted', -1), makePlant('p-keep', 0)]);
    component.pendingDeleteIds.set(new Set(['p-deleted']));

    const g = component.plantsGrouped();
    const allIds = [...g.overdue, ...g.today, ...g.soon, ...g.upcoming].map((p) => p.id);
    expect(allIds).not.toContain('p-deleted');
    expect(allIds).toContain('p-keep');
  });

  it('returns empty groups when there are no plants', () => {
    plantsSignal.set([]);

    const g = component.plantsGrouped();
    expect(g.overdue).toHaveLength(0);
    expect(g.today).toHaveLength(0);
    expect(g.soon).toHaveLength(0);
    expect(g.upcoming).toHaveLength(0);
  });

  describe('attentionCount', () => {
    it('is the sum of overdue and today plants', () => {
      plantsSignal.set([
        makePlant('o1', -2),
        makePlant('o2', -1),
        makePlant('t1', 0),
        makePlant('s1', 1),
      ]);

      expect(component.attentionCount()).toBe(3);
    });
  });

  describe('soonCount', () => {
    it('equals the number of plants in the soon bucket', () => {
      plantsSignal.set([makePlant('s1', 1), makePlant('s2', 3), makePlant('u1', 8)]);

      expect(component.soonCount()).toBe(2);
    });
  });
});

import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SoilCheckDialogComponent } from './soil-check-dialog';
import type { Plant } from '../plant.model';

// Fixed reference: June 15 2024 at 14:00 local time
const FIXED_NOW = new Date(2024, 5, 15, 14, 0, 0);

function localMidnight(offsetDays: number): string {
  return new Date(2024, 5, 15 + offsetDays).toISOString();
}

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 'p1',
    user_id: 'u1',
    zone_id: 'z1',
    common_name: 'Monstera',
    scientific_name: null,
    perenual_id: null,
    container_vector: 'Terracotta',
    substrate_factor: 'Standard Potting',
    growth_stage: 'Mature',
    last_checked_at: null,
    next_check_due_at: localMidnight(7),
    current_snooze_interval_days: 7,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

describe('SoilCheckDialogComponent', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: FIXED_NOW.getTime() });
    await TestBed.configureTestingModule({
      imports: [SoilCheckDialogComponent, RouterModule.forRoot([])],
    })
      .overrideTemplate(SoilCheckDialogComponent, '')
      .compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(plant: Plant): SoilCheckDialogComponent {
    const fixture = TestBed.createComponent(SoilCheckDialogComponent);
    fixture.componentRef.setInput('plant', plant);
    return fixture.componentInstance;
  }

  // ── checkDepth ─────────────────────────────────────────────────────────────

  describe('checkDepth()', () => {
    it('returns "3 cm" for Standard Potting', () => {
      expect(setup(makePlant({ substrate_factor: 'Standard Potting' })).checkDepth()).toBe('3 cm');
    });

    it('returns "3 cm" for High-Drainage Aroid', () => {
      expect(setup(makePlant({ substrate_factor: 'High-Drainage Aroid' })).checkDepth()).toBe(
        '3 cm',
      );
    });

    it('returns "3 cm" for Heavy Peat', () => {
      expect(setup(makePlant({ substrate_factor: 'Heavy Peat' })).checkDepth()).toBe('3 cm');
    });

    it('returns "2 cm" for Sphagnum Moss Mix', () => {
      expect(setup(makePlant({ substrate_factor: 'Sphagnum Moss Mix' })).checkDepth()).toBe('2 cm');
    });

    it('returns "5 cm" for Desert Succulent', () => {
      expect(setup(makePlant({ substrate_factor: 'Desert Succulent' })).checkDepth()).toBe('5 cm');
    });
  });

  // ── lastCheckedLabel ───────────────────────────────────────────────────────

  describe('lastCheckedLabel()', () => {
    it('returns "never checked" when last_checked_at is null', () => {
      expect(setup(makePlant({ last_checked_at: null })).lastCheckedLabel()).toBe('never checked');
    });

    it('returns "last checked today" when checked less than half a day ago', () => {
      const ts = new Date(FIXED_NOW.getTime() - 2 * 3_600_000).toISOString();
      const c = setup(makePlant({ last_checked_at: ts }));
      expect(c.lastCheckedLabel()).toBe('last checked today');
    });

    it('returns "last checked yesterday" when checked exactly 1 day ago', () => {
      const ts = new Date(FIXED_NOW.getTime() - 86_400_000).toISOString();
      const c = setup(makePlant({ last_checked_at: ts }));
      expect(c.lastCheckedLabel()).toBe('last checked yesterday');
    });

    it('returns "last checked N days ago" for older checks', () => {
      const ts = new Date(FIXED_NOW.getTime() - 5 * 86_400_000).toISOString();
      const c = setup(makePlant({ last_checked_at: ts }));
      expect(c.lastCheckedLabel()).toBe('last checked 5 days ago');
    });
  });

  // ── recommendedDays ────────────────────────────────────────────────────────
  // All cases have no botanical record (scientific_name is null) → watering
  // multiplier falls back to ×1.0. Only the matrix and growth stage vary.

  describe('recommendedDays()', () => {
    it('Terracotta + Standard Potting + Mature → snaps to 2 days (matrix=3, raw=3)', () => {
      const c = setup(
        makePlant({
          container_vector: 'Terracotta',
          substrate_factor: 'Standard Potting',
          growth_stage: 'Mature',
        }),
      );
      expect(c.recommendedDays()).toBe(2);
    });

    it('Plastic + Heavy Peat + Mature → snaps to 7 days (matrix=7, raw=7)', () => {
      const c = setup(
        makePlant({
          container_vector: 'Plastic',
          substrate_factor: 'Heavy Peat',
          growth_stage: 'Mature',
        }),
      );
      expect(c.recommendedDays()).toBe(7);
    });

    it('Plastic + Heavy Peat + Dormant → snaps to 14 days (matrix=7 × 2.0 = 14)', () => {
      const c = setup(
        makePlant({
          container_vector: 'Plastic',
          substrate_factor: 'Heavy Peat',
          growth_stage: 'Dormant',
        }),
      );
      expect(c.recommendedDays()).toBe(14);
    });

    it('Plastic + Heavy Peat + Seedling → snaps to 5 days (matrix=7 × 0.5 = 3.5 → rounds to 4)', () => {
      const c = setup(
        makePlant({
          container_vector: 'Plastic',
          substrate_factor: 'Heavy Peat',
          growth_stage: 'Seedling',
        }),
      );
      expect(c.recommendedDays()).toBe(5);
    });

    it('clamps to 14 max — Self-Watering + Heavy Peat + Dormant = 7 × 2.0 = 14', () => {
      const c = setup(
        makePlant({
          container_vector: 'Self-Watering',
          substrate_factor: 'Heavy Peat',
          growth_stage: 'Dormant',
        }),
      );
      expect(c.recommendedDays()).toBe(14);
    });
  });

  // ── step state machine ─────────────────────────────────────────────────────

  describe('step state machine', () => {
    it('starts in the "ask" step', () => {
      expect(setup(makePlant()).step()).toBe('ask');
    });

    it('transitions to "schedule" with isWatering=true on onDry()', () => {
      const c = setup(makePlant());
      c.onDry();
      expect(c.step()).toBe('schedule');
      expect(c.isWatering()).toBe(true);
    });

    it('transitions to "schedule" with isWatering=false on onMoist()', () => {
      const c = setup(makePlant());
      c.onMoist();
      expect(c.step()).toBe('schedule');
      expect(c.isWatering()).toBe(false);
    });

    it('returns to "ask" on onBack()', () => {
      const c = setup(makePlant());
      c.onDry();
      c.onBack();
      expect(c.step()).toBe('ask');
    });

    it('resets step to "ask" on onVisibleChange(false)', () => {
      const c = setup(makePlant());
      c.onDry();
      c.onVisibleChange(false);
      expect(c.step()).toBe('ask');
    });

    it('resets step to "ask" on onMoist() + onBack()', () => {
      const c = setup(makePlant());
      c.onMoist();
      c.onBack();
      expect(c.step()).toBe('ask');
    });

    it('resets note to "" on onVisibleChange(false)', () => {
      const c = setup(makePlant());
      c.note.set('some note');
      c.onVisibleChange(false);
      expect(c.note()).toBe('');
    });
  });

  // ── outputs ────────────────────────────────────────────────────────────────

  describe('onConfirm()', () => {
    it('emits the confirmed output with the current plant, note, and selected days', () => {
      const plant = makePlant();
      const c = setup(plant);
      c.onDry(); // initializes snoozeDays to recommendedDays() — Terracotta + Standard + Mature → 2
      c.note.set('looks very dry');
      const spy = vi.spyOn(c.confirmed, 'emit');

      c.onConfirm();

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith({ plant, note: 'looks very dry', days: 2 });
    });

    it('resets step and note after confirming', () => {
      const c = setup(makePlant());
      c.onDry();
      c.note.set('dry note');
      c.onConfirm();
      expect(c.step()).toBe('ask');
      expect(c.note()).toBe('');
    });
  });

  describe('onSnooze()', () => {
    it('emits the snoozed output with the plant id and selected snooze days', () => {
      const c = setup(makePlant({ id: 'plant-xyz' }));
      c.snoozeDays.set(7);
      const spy = vi.spyOn(c.snoozed, 'emit');

      c.onSnooze();

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith({ id: 'plant-xyz', days: 7 });
    });

    it('resets step after snoozing', () => {
      const c = setup(makePlant());
      c.onMoist();
      c.onSnooze();
      expect(c.step()).toBe('ask');
    });
  });
});

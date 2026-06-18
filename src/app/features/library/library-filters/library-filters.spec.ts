import { TestBed } from '@angular/core/testing';
import { Signal, WritableSignal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryFiltersComponent, FilterLabels } from './library-filters';
import { LibraryFilters } from '../library.service';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';

const LABELS: FilterLabels = {
  placement: { Indoor: 'Indoor', Outdoor: 'Outdoor', Both: 'Both' },
  watering: { Frequent: 'Frequent', Average: 'Average', Minimum: 'Minimum', None: 'None' },
  sunlight: {
    full_sun: 'Full sun',
    part_shade: 'Part shade',
    full_shade: 'Shade',
    filtered_indirect: 'Indirect',
  },
  cycle: { Perennial: 'Perennial', Annual: 'Annual', Biennial: 'Biennial' },
  careDifficulty: { Beginner: 'Beginner', Intermediate: 'Intermediate', Advanced: 'Advanced' },
  maintenance: { Low: 'Low', Medium: 'Medium', High: 'High' },
};

type LibraryFiltersInternals = {
  onTogglePlacementFilter(value: string): void;
  onToggleFilter(key: 'watering' | 'sunlight' | 'cycle', value: string): void;
  onToggleMultiFilter(key: 'careDifficulty' | 'maintenanceLevel', value: string): void;
  onPhChange(event: { values?: number[] }): void;
  onToggleTooltip(event: Event, id: string, text: string): void;
  onMouseLeaveTooltip(): void;
  onEscapeTooltip(): void;
  _activeHandle: 0 | 1 | null;
  openTooltipId: WritableSignal<string | null>;
  hasPlacementFilter: Signal<boolean>;
  hasSunlightFilter: Signal<boolean>;
  hasDifficultyFilter: Signal<boolean>;
  hasMaintenanceFilter: Signal<boolean>;
  hasTraitFilters: Signal<boolean>;
  hasPhFilter: Signal<boolean>;
  localPhRange: Signal<number[]>;
  localPhDisplay: Signal<number[]>;
};

function internals(comp: LibraryFiltersComponent): LibraryFiltersInternals {
  return comp as unknown as LibraryFiltersInternals;
}

describe('LibraryFiltersComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LibraryFiltersComponent],
      providers: [...provideTranslocoTesting()],
    }).overrideTemplate(LibraryFiltersComponent, '');
  });

  function create(filters: LibraryFilters = {}, phRange = [0, 14]) {
    const fixture = TestBed.createComponent(LibraryFiltersComponent);
    fixture.componentRef.setInput('filters', filters);
    fixture.componentRef.setInput('filterLabels', LABELS);
    fixture.componentRef.setInput('phRange', phRange);
    fixture.detectChanges();
    TestBed.flushEffects();
    return fixture;
  }

  describe('onTogglePlacementFilter', () => {
    it('sets placement when none is active', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onTogglePlacementFilter('Indoor');
      expect(emitSpy).toHaveBeenCalledWith({ placement: 'Indoor' });
    });

    it('removes placement when the same value is toggled off', () => {
      const fixture = create({ placement: 'Indoor' });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onTogglePlacementFilter('Indoor');
      const emitted = emitSpy.mock.calls[0][0] as LibraryFilters;
      expect(emitted).not.toHaveProperty('placement');
    });

    it('switches to a different placement value', () => {
      const fixture = create({ placement: 'Outdoor' });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onTogglePlacementFilter('Indoor');
      expect(emitSpy).toHaveBeenCalledWith({ placement: 'Indoor' });
    });

    it('preserves unrelated filter keys', () => {
      const fixture = create({ placement: 'Indoor', watering: 'Frequent' });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onTogglePlacementFilter('Outdoor');
      const emitted = emitSpy.mock.calls[0][0] as LibraryFilters;
      expect(emitted.watering).toBe('Frequent');
    });
  });

  describe('onToggleFilter (single-select)', () => {
    it('sets the key when not active', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleFilter('watering', 'Frequent');
      expect(emitSpy).toHaveBeenCalledWith({ watering: 'Frequent' });
    });

    it('removes the key when the same value is toggled off', () => {
      const fixture = create({ watering: 'Frequent' });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleFilter('watering', 'Frequent');
      const emitted = emitSpy.mock.calls[0][0] as LibraryFilters;
      expect(emitted).not.toHaveProperty('watering');
    });

    it('replaces the key with a different value', () => {
      const fixture = create({ sunlight: 'full_sun' });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleFilter('sunlight', 'part_shade');
      expect(emitSpy).toHaveBeenCalledWith({ sunlight: 'part_shade' });
    });

    it('preserves unrelated filter keys when toggling off', () => {
      const fixture = create({ placement: 'Indoor', watering: 'Frequent' });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleFilter('watering', 'Frequent');
      const emitted = emitSpy.mock.calls[0][0] as LibraryFilters;
      expect(emitted.placement).toBe('Indoor');
      expect(emitted).not.toHaveProperty('watering');
    });
  });

  describe('onToggleMultiFilter', () => {
    it('adds the first value as an array', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleMultiFilter('careDifficulty', 'Beginner');
      expect(emitSpy).toHaveBeenCalledWith({ careDifficulty: ['Beginner'] });
    });

    it('appends to an existing array', () => {
      const fixture = create({ careDifficulty: ['Beginner'] });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleMultiFilter('careDifficulty', 'Advanced');
      expect(emitSpy).toHaveBeenCalledWith({ careDifficulty: ['Beginner', 'Advanced'] });
    });

    it('removes one value from a multi-value array', () => {
      const fixture = create({ careDifficulty: ['Beginner', 'Advanced'] });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleMultiFilter('careDifficulty', 'Beginner');
      expect(emitSpy).toHaveBeenCalledWith({ careDifficulty: ['Advanced'] });
    });

    it('removes the key entirely when the last value is deselected', () => {
      const fixture = create({ careDifficulty: ['Beginner'] });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleMultiFilter('careDifficulty', 'Beginner');
      const emitted = emitSpy.mock.calls[0][0] as LibraryFilters;
      expect(emitted).not.toHaveProperty('careDifficulty');
    });

    it('works independently for maintenanceLevel', () => {
      const fixture = create({ maintenanceLevel: ['Low', 'High'] });
      const comp = fixture.componentInstance;
      const emitSpy = vi.spyOn(comp.filterChange, 'emit');
      internals(comp).onToggleMultiFilter('maintenanceLevel', 'Low');
      expect(emitSpy).toHaveBeenCalledWith({ maintenanceLevel: ['High'] });
    });
  });

  describe('onPhChange', () => {
    it('sets localPhRange and localPhDisplay when handles do not cross', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      internals(comp).onPhChange({ values: [3, 9] });
      expect(internals(comp).localPhRange()).toEqual([3, 9]);
      expect(internals(comp).localPhDisplay()).toEqual([3, 9]);
    });

    it('clamps both handles to active handle (0) when they cross', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      internals(comp)._activeHandle = 0;
      internals(comp).onPhChange({ values: [8, 4] });
      expect(internals(comp).localPhRange()).toEqual([8, 8]);
      expect(internals(comp).localPhDisplay()).toEqual([8, 8]);
    });

    it('clamps both handles to active handle (1) when they cross', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      internals(comp)._activeHandle = 1;
      internals(comp).onPhChange({ values: [8, 4] });
      expect(internals(comp).localPhRange()).toEqual([4, 4]);
      expect(internals(comp).localPhDisplay()).toEqual([4, 4]);
    });

    it('does not throw when values are absent', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      expect(() => internals(comp).onPhChange({})).not.toThrow();
    });
  });

  describe('computed filter-active flags', () => {
    it('hasPlacementFilter is true when placement is set', () => {
      const fixture = create({ placement: 'Indoor' });
      expect(internals(fixture.componentInstance).hasPlacementFilter()).toBe(true);
    });

    it('hasPlacementFilter is false when placement is absent', () => {
      const fixture = create();
      expect(internals(fixture.componentInstance).hasPlacementFilter()).toBe(false);
    });

    it('hasSunlightFilter is true when sunlight is set', () => {
      const fixture = create({ sunlight: 'full_sun' });
      expect(internals(fixture.componentInstance).hasSunlightFilter()).toBe(true);
    });

    it('hasDifficultyFilter is true when careDifficulty has entries', () => {
      const fixture = create({ careDifficulty: ['Beginner'] });
      expect(internals(fixture.componentInstance).hasDifficultyFilter()).toBe(true);
    });

    it('hasDifficultyFilter is false when careDifficulty is absent', () => {
      const fixture = create();
      expect(internals(fixture.componentInstance).hasDifficultyFilter()).toBe(false);
    });

    it('hasMaintenanceFilter is true when maintenanceLevel has entries', () => {
      const fixture = create({ maintenanceLevel: ['Low'] });
      expect(internals(fixture.componentInstance).hasMaintenanceFilter()).toBe(true);
    });

    it('hasTraitFilters is true when any trait boolean is set', () => {
      const fixture = create({ isPetSafe: true });
      expect(internals(fixture.componentInstance).hasTraitFilters()).toBe(true);
    });

    it('hasTraitFilters is false when no trait is set', () => {
      const fixture = create();
      expect(internals(fixture.componentInstance).hasTraitFilters()).toBe(false);
    });
  });

  describe('phRange input sync effect', () => {
    it('initialises localPhRange from the phRange input', () => {
      const fixture = create({}, [4, 9]);
      expect(internals(fixture.componentInstance).localPhRange()).toEqual([4, 9]);
      expect(internals(fixture.componentInstance).localPhDisplay()).toEqual([4, 9]);
    });

    it('resets local pH state when phRange input changes', () => {
      const fixture = create({}, [3, 8]);
      fixture.componentRef.setInput('phRange', [0, 14]);
      TestBed.flushEffects();
      expect(internals(fixture.componentInstance).localPhRange()).toEqual([0, 14]);
      expect(internals(fixture.componentInstance).localPhDisplay()).toEqual([0, 14]);
    });

    it('hasPhFilter is true when localPhRange differs from [0, 14]', () => {
      const fixture = create({}, [3, 10]);
      expect(internals(fixture.componentInstance).hasPhFilter()).toBe(true);
    });

    it('hasPhFilter is false at default [0, 14]', () => {
      const fixture = create();
      expect(internals(fixture.componentInstance).hasPhFilter()).toBe(false);
    });
  });

  describe('onToggleTooltip', () => {
    function makeTooltipEvent(): Event {
      const el = {
        getBoundingClientRect: () => ({ right: 100, top: 50, height: 20 }),
      } as unknown as HTMLElement;
      return { stopPropagation: vi.fn(), currentTarget: el } as unknown as Event;
    }

    it('opens a tooltip and emits tooltipShow with position + text', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const showSpy = vi.spyOn(comp.tooltipShow, 'emit');
      internals(comp).onToggleTooltip(makeTooltipEvent(), 'placement', 'tip text');
      expect(internals(comp).openTooltipId()).toBe('placement');
      expect(showSpy).toHaveBeenCalledWith(expect.objectContaining({ text: 'tip text' }));
    });

    it('closes the same tooltip and emits tooltipHide when toggled again', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const hideSpy = vi.spyOn(comp.tooltipHide, 'emit');
      const event = makeTooltipEvent();
      internals(comp).onToggleTooltip(event, 'placement', 'tip');
      internals(comp).onToggleTooltip(event, 'placement', 'tip');
      expect(internals(comp).openTooltipId()).toBeNull();
      expect(hideSpy).toHaveBeenCalled();
    });

    it('switches to a different tooltip without leaving the first open', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const showSpy = vi.spyOn(comp.tooltipShow, 'emit');
      const event = makeTooltipEvent();
      internals(comp).onToggleTooltip(event, 'placement', 'text a');
      internals(comp).onToggleTooltip(event, 'sunlight', 'text b');
      expect(internals(comp).openTooltipId()).toBe('sunlight');
      expect(showSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('onMouseLeaveTooltip', () => {
    it('emits tooltipHide when no tooltip is pinned', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const hideSpy = vi.spyOn(comp.tooltipHide, 'emit');
      internals(comp).onMouseLeaveTooltip();
      expect(hideSpy).toHaveBeenCalled();
    });

    it('does not emit tooltipHide when a tooltip is pinned open', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      internals(comp).openTooltipId.set('placement');
      const hideSpy = vi.spyOn(comp.tooltipHide, 'emit');
      internals(comp).onMouseLeaveTooltip();
      expect(hideSpy).not.toHaveBeenCalled();
    });
  });

  describe('onEscapeTooltip', () => {
    it('clears openTooltipId and emits tooltipHide when a tooltip is open', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      internals(comp).openTooltipId.set('sunlight');
      const hideSpy = vi.spyOn(comp.tooltipHide, 'emit');
      internals(comp).onEscapeTooltip();
      expect(internals(comp).openTooltipId()).toBeNull();
      expect(hideSpy).toHaveBeenCalled();
    });

    it('does not emit tooltipHide when no tooltip is open', () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const hideSpy = vi.spyOn(comp.tooltipHide, 'emit');
      internals(comp).onEscapeTooltip();
      expect(hideSpy).not.toHaveBeenCalled();
    });
  });
});

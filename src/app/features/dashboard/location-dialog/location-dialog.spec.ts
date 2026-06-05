import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import type { WritableSignal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocationDialogComponent, type GeoResult } from './location-dialog';

// Typed harness for protected members — avoids `any` while allowing test access.
type LocationDialogHarness = {
  suggestions: WritableSignal<GeoResult[]>;
};

function makeResult(overrides: Partial<GeoResult> = {}): GeoResult {
  return {
    id: 1,
    name: 'Brussels',
    latitude: 50.85,
    longitude: 4.35,
    admin1: 'Brussels Capital',
    country: 'Belgium',
    ...overrides,
  };
}

describe('LocationDialogComponent', () => {
  let component: LocationDialogComponent;
  let harness: LocationDialogHarness;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LocationDialogComponent],
      providers: [provideHttpClient()],
    })
      .overrideTemplate(LocationDialogComponent, '')
      .compileComponents();

    const fixture = TestBed.createComponent(LocationDialogComponent);
    component = fixture.componentInstance;
    harness = component as unknown as LocationDialogHarness;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── formatLabel ────────────────────────────────────────────────────────────

  describe('formatLabel()', () => {
    it('returns "Current location" for the geo-detect sentinel result', () => {
      const r = makeResult({ id: 0, name: 'Current location', admin1: null, country: '' });
      expect(component.formatLabel(r)).toBe('Current location');
    });

    it('joins name, admin1, and country when all are present', () => {
      expect(component.formatLabel(makeResult())).toBe('Brussels, Brussels Capital, Belgium');
    });

    it('omits admin1 when it is null', () => {
      expect(component.formatLabel(makeResult({ admin1: null }))).toBe('Brussels, Belgium');
    });

    it('omits empty string segments', () => {
      expect(component.formatLabel(makeResult({ admin1: '', country: '' }))).toBe('Brussels');
    });

    it('handles a result with only a name', () => {
      expect(component.formatLabel(makeResult({ admin1: null, country: '' }))).toBe('Brussels');
    });
  });

  // ── onSearchBlur ───────────────────────────────────────────────────────────

  describe('onSearchBlur()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('clears suggestions after 150 ms to let suggestion clicks fire first', () => {
      harness.suggestions.set([makeResult()]);
      expect(harness.suggestions()).toHaveLength(1);

      component.onSearchBlur();
      expect(harness.suggestions()).toHaveLength(1); // not yet cleared

      vi.advanceTimersByTime(150);
      expect(harness.suggestions()).toHaveLength(0);
    });

    it('does not clear suggestions before 150 ms', () => {
      harness.suggestions.set([makeResult()]);
      component.onSearchBlur();

      vi.advanceTimersByTime(149);
      expect(harness.suggestions()).toHaveLength(1);
    });
  });
});

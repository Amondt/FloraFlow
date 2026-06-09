import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { SpeciesPhotoCarouselComponent } from './species-photo-carousel';

describe('SpeciesPhotoCarouselComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SpeciesPhotoCarouselComponent],
    })
      .overrideTemplate(SpeciesPhotoCarouselComponent, '')
      .compileComponents();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function create(photos: string[] = []): any {
    const fixture = TestBed.createComponent(SpeciesPhotoCarouselComponent);
    fixture.componentRef.setInput('photos', photos);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('hasMultiple()', () => {
    it('returns false with zero photos', () => {
      expect(create([]).hasMultiple()).toBe(false);
    });

    it('returns false with one photo', () => {
      expect(create(['a']).hasMultiple()).toBe(false);
    });

    it('returns true with two or more photos', () => {
      expect(create(['a', 'b']).hasMultiple()).toBe(true);
    });
  });

  describe('boundary flags', () => {
    it('hasPrev is false at index 0', () => {
      expect(create(['a', 'b']).hasPrev()).toBe(false);
    });

    it('hasPrev is true when index > 0', () => {
      const c = create(['a', 'b']);
      c['activeIndex'].set(1);
      expect(c.hasPrev()).toBe(true);
    });

    it('hasNext is true when not at the last index', () => {
      expect(create(['a', 'b']).hasNext()).toBe(true);
    });

    it('hasNext is false at the last index', () => {
      const c = create(['a', 'b']);
      c['activeIndex'].set(1);
      expect(c.hasNext()).toBe(false);
    });
  });

  describe('next()', () => {
    it('increments activeIndex by one', () => {
      const c = create(['a', 'b', 'c']);
      c['next']();
      expect(c['activeIndex']()).toBe(1);
    });

    it('does not exceed the last index', () => {
      const c = create(['a', 'b']);
      c['activeIndex'].set(1);
      c['next']();
      expect(c['activeIndex']()).toBe(1);
    });
  });

  describe('prev()', () => {
    it('decrements activeIndex by one', () => {
      const c = create(['a', 'b', 'c']);
      c['activeIndex'].set(2);
      c['prev']();
      expect(c['activeIndex']()).toBe(1);
    });

    it('does not go below 0', () => {
      const c = create(['a', 'b']);
      c['prev']();
      expect(c['activeIndex']()).toBe(0);
    });
  });
});

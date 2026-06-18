import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PhotoLightboxDialogComponent } from './photo-lightbox-dialog';

const THREE_PHOTOS = ['https://a.com/1.jpg', 'https://a.com/2.jpg', 'https://a.com/3.jpg'];

describe('PhotoLightboxDialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PhotoLightboxDialogComponent],
    })
      .overrideTemplate(PhotoLightboxDialogComponent, '')
      .compileComponents();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function create(photos: string[] = THREE_PHOTOS, initialIndex = 0): any {
    const fixture = TestBed.createComponent(PhotoLightboxDialogComponent);
    fixture.componentRef.setInput('photos', photos);
    fixture.componentRef.setInput('initialIndex', initialIndex);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  describe('hasMultiple()', () => {
    it('is false for a single photo', () => {
      expect(create(['a']).hasMultiple()).toBe(false);
    });

    it('is true for two or more photos', () => {
      expect(create(THREE_PHOTOS).hasMultiple()).toBe(true);
    });
  });

  describe('boundary flags', () => {
    it('hasPrev is false at index 0', () => {
      expect(create(THREE_PHOTOS).hasPrev()).toBe(false);
    });

    it('hasPrev is true when past the first photo', () => {
      const c = create(THREE_PHOTOS);
      c['activeIndex'].set(1);
      expect(c.hasPrev()).toBe(true);
    });

    it('hasNext is true when not at the last photo', () => {
      expect(create(THREE_PHOTOS).hasNext()).toBe(true);
    });

    it('hasNext is false at the last photo', () => {
      const c = create(THREE_PHOTOS);
      c['activeIndex'].set(2);
      expect(c.hasNext()).toBe(false);
    });
  });

  describe('next()', () => {
    it('increments activeIndex', () => {
      const c = create(THREE_PHOTOS);
      c['next']();
      expect(c['activeIndex']()).toBe(1);
    });

    it('clamps at the last index', () => {
      const c = create(THREE_PHOTOS);
      c['activeIndex'].set(2);
      c['next']();
      expect(c['activeIndex']()).toBe(2);
    });
  });

  describe('prev()', () => {
    it('decrements activeIndex', () => {
      const c = create(THREE_PHOTOS);
      c['activeIndex'].set(2);
      c['prev']();
      expect(c['activeIndex']()).toBe(1);
    });

    it('clamps at 0', () => {
      const c = create(THREE_PHOTOS);
      c['prev']();
      expect(c['activeIndex']()).toBe(0);
    });
  });

  describe('goToIndex()', () => {
    it('sets activeIndex to the given value', () => {
      const c = create(THREE_PHOTOS);
      c['goToIndex'](2);
      expect(c['activeIndex']()).toBe(2);
    });

    it('does not set isImageLoading when called with the current index', () => {
      const c = create(THREE_PHOTOS);
      c['isImageLoading'].set(false);
      c['goToIndex'](0);
      expect(c['isImageLoading']()).toBe(false);
    });
  });

  describe('close()', () => {
    it('sets visible to false', () => {
      const c = create(THREE_PHOTOS);
      c.visible.set(true);
      c['close']();
      expect(c.visible()).toBe(false);
    });
  });

  describe('onEscapeKey()', () => {
    it('closes when visible is true', () => {
      const c = create(THREE_PHOTOS);
      c.visible.set(true);
      c['onEscapeKey']();
      expect(c.visible()).toBe(false);
    });

    it('does nothing when visible is false', () => {
      const c = create(THREE_PHOTOS);
      c.visible.set(false);
      c['onEscapeKey']();
      expect(c.visible()).toBe(false);
    });
  });

  describe('onImageLoad()', () => {
    it('sets isImageLoading to false', () => {
      const c = create(THREE_PHOTOS);
      c['isImageLoading'].set(true);
      c['onImageLoad']();
      expect(c['isImageLoading']()).toBe(false);
    });
  });

  describe('swipe navigation', () => {
    function ptr(clientX: number, pointerId = 1): PointerEvent {
      return { clientX, pointerId } as unknown as PointerEvent;
    }

    it('navigates to next photo on a left swipe exceeding threshold', () => {
      const c = create(THREE_PHOTOS);
      c['onLightboxPointerDown'](ptr(100));
      c['onLightboxPointerUp'](ptr(50)); // delta = -50
      expect(c['activeIndex']()).toBe(1);
    });

    it('navigates to prev photo on a right swipe exceeding threshold', () => {
      const c = create(THREE_PHOTOS);
      c['activeIndex'].set(2);
      c['onLightboxPointerDown'](ptr(100));
      c['onLightboxPointerUp'](ptr(150)); // delta = +50
      expect(c['activeIndex']()).toBe(1);
    });

    it('does not navigate when delta is below the 40 px threshold', () => {
      const c = create(THREE_PHOTOS);
      c['onLightboxPointerDown'](ptr(100));
      c['onLightboxPointerUp'](ptr(70)); // delta = -30
      expect(c['activeIndex']()).toBe(0);
    });

    it('ignores pointerup from a different pointer id', () => {
      const c = create(THREE_PHOTOS);
      c['onLightboxPointerDown'](ptr(100, 1));
      c['onLightboxPointerUp'](ptr(50, 2));
      expect(c['activeIndex']()).toBe(0);
    });

    it('resets hasSwiped on pointercancel so close() works afterwards', () => {
      const c = create(THREE_PHOTOS);
      c.visible.set(true);
      c['onLightboxPointerDown'](ptr(100));
      c['onLightboxPointerCancel']();
      c['close']();
      expect(c.visible()).toBe(false);
    });
  });

  describe('close() swipe guard', () => {
    function ptr(clientX: number, pointerId = 1): PointerEvent {
      return { clientX, pointerId } as unknown as PointerEvent;
    }

    it('does not close after a swipe completes (guard consumes the click)', () => {
      const c = create(THREE_PHOTOS);
      c.visible.set(true);
      c['onLightboxPointerDown'](ptr(100));
      c['onLightboxPointerUp'](ptr(50)); // left swipe
      c['close']();
      expect(c.visible()).toBe(true);
    });

    it('clears the guard after firing so the next close() call succeeds', () => {
      const c = create(THREE_PHOTOS);
      c.visible.set(true);
      c['onLightboxPointerDown'](ptr(100));
      c['onLightboxPointerUp'](ptr(50)); // swipe — sets _hasSwiped
      c['close'](); // guard fires, resets _hasSwiped
      c['close'](); // now closes
      expect(c.visible()).toBe(false);
    });
  });
});

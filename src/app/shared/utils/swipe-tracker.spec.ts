import { describe, it, expect, vi } from 'vitest';
import { SwipeTracker } from './swipe-tracker';

function ptr(clientX: number, pointerId = 1): PointerEvent {
  return { clientX, pointerId } as unknown as PointerEvent;
}

describe('SwipeTracker', () => {
  describe('onPointerUp — threshold', () => {
    it('calls onNext when leftward delta meets threshold', () => {
      const tracker = new SwipeTracker();
      const onNext = vi.fn();
      tracker.onPointerDown(ptr(100));
      const result = tracker.onPointerUp(ptr(50), vi.fn(), onNext); // delta = -50
      expect(onNext).toHaveBeenCalledOnce();
      expect(result).toBe(true);
    });

    it('calls onPrev when rightward delta meets threshold', () => {
      const tracker = new SwipeTracker();
      const onPrev = vi.fn();
      tracker.onPointerDown(ptr(100));
      const result = tracker.onPointerUp(ptr(150), onPrev, vi.fn()); // delta = +50
      expect(onPrev).toHaveBeenCalledOnce();
      expect(result).toBe(true);
    });

    it('does not call either callback when delta is below threshold', () => {
      const tracker = new SwipeTracker();
      const onPrev = vi.fn();
      const onNext = vi.fn();
      tracker.onPointerDown(ptr(100));
      const result = tracker.onPointerUp(ptr(70), onPrev, onNext); // delta = -30
      expect(onPrev).not.toHaveBeenCalled();
      expect(onNext).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('ignores pointerup from a different pointer id', () => {
      const tracker = new SwipeTracker();
      const onNext = vi.fn();
      tracker.onPointerDown(ptr(100, 1));
      const result = tracker.onPointerUp(ptr(50, 2), vi.fn(), onNext);
      expect(onNext).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('custom threshold', () => {
    it('respects a custom threshold passed to the constructor', () => {
      const tracker = new SwipeTracker(80);
      const onNext = vi.fn();
      tracker.onPointerDown(ptr(100));
      tracker.onPointerUp(ptr(50), vi.fn(), onNext); // delta = -50 < 80 → no fire
      expect(onNext).not.toHaveBeenCalled();
      tracker.onPointerDown(ptr(200));
      tracker.onPointerUp(ptr(100), vi.fn(), onNext); // delta = -100 >= 80 → fires
      expect(onNext).toHaveBeenCalledOnce();
    });
  });

  describe('onPointerCancel', () => {
    it('prevents subsequent pointerup from firing', () => {
      const tracker = new SwipeTracker();
      const onNext = vi.fn();
      tracker.onPointerDown(ptr(100));
      tracker.onPointerCancel();
      tracker.onPointerUp(ptr(50), vi.fn(), onNext);
      expect(onNext).not.toHaveBeenCalled();
    });
  });
});

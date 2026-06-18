export class SwipeTracker {
  private readonly _threshold: number;
  private _startX = 0;
  private _pointerId = -1;

  constructor(threshold = 40) {
    this._threshold = threshold;
  }

  onPointerDown(event: PointerEvent): void {
    this._startX = event.clientX;
    this._pointerId = event.pointerId;
  }

  /** Calls onNext or onPrev when the swipe threshold is met. Returns true if a swipe fired. */
  onPointerUp(event: PointerEvent, onPrev: () => void, onNext: () => void): boolean {
    if (event.pointerId !== this._pointerId) return false;
    const deltaX = event.clientX - this._startX;
    this._pointerId = -1;
    if (Math.abs(deltaX) < this._threshold) return false;
    if (deltaX < 0) onNext();
    else onPrev();
    return true;
  }

  onPointerCancel(): void {
    this._pointerId = -1;
  }
}

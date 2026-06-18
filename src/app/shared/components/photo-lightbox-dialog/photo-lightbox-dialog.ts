import { Component, computed, effect, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { SwipeTracker } from '../../utils/swipe-tracker';

@Component({
  selector: 'app-photo-lightbox-dialog',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './photo-lightbox-dialog.html',
  host: {
    '(document:keydown.escape)': 'onEscapeKey()',
  },
})
export class PhotoLightboxDialogComponent {
  readonly photos = input<string[]>([]);
  readonly altText = input<string>('');
  readonly visible = model<boolean>(false);
  readonly initialIndex = input<number>(0);

  protected readonly activeIndex = signal(0);
  protected readonly hasMultiple = computed(() => this.photos().length > 1);
  protected readonly hasPrev = computed(() => this.activeIndex() > 0);
  protected readonly hasNext = computed(() => this.activeIndex() < this.photos().length - 1);
  protected readonly isImageLoading = signal(false);

  private readonly _swipeTracker = new SwipeTracker();
  private _hasSwiped = false;

  constructor() {
    // Reset index and trigger loading when the photo array is replaced (new species opened).
    effect(() => {
      this.photos();
      this.activeIndex.set(this.initialIndex());
      this.isImageLoading.set(true);
    });

    // When the lightbox opens, jump to the requested start index.
    effect(() => {
      if (this.visible()) {
        this.activeIndex.set(this.initialIndex());
        this.isImageLoading.set(true);
      }
    });
  }

  protected prev(): void {
    if (this.hasPrev()) {
      this.isImageLoading.set(true);
      this.activeIndex.update((i) => i - 1);
    }
  }

  protected next(): void {
    if (this.hasNext()) {
      this.isImageLoading.set(true);
      this.activeIndex.update((i) => i + 1);
    }
  }

  protected goToIndex(index: number): void {
    if (index !== this.activeIndex()) {
      this.isImageLoading.set(true);
      this.activeIndex.set(index);
    }
  }

  protected close(): void {
    if (this._hasSwiped) {
      this._hasSwiped = false;
      return;
    }
    this.visible.set(false);
  }

  protected onLightboxPointerDown(event: PointerEvent): void {
    this._swipeTracker.onPointerDown(event);
    this._hasSwiped = false;
  }

  protected onLightboxPointerUp(event: PointerEvent): void {
    this._hasSwiped = this._swipeTracker.onPointerUp(
      event,
      () => this.prev(),
      () => this.next(),
    );
  }

  protected onLightboxPointerCancel(): void {
    this._swipeTracker.onPointerCancel();
    this._hasSwiped = false;
  }

  protected onImageLoad(): void {
    this.isImageLoading.set(false);
  }

  protected onEscapeKey(): void {
    if (this.visible()) this.close();
  }
}

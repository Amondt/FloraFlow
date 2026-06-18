import { Component, computed, effect, input, output, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LeafIconComponent } from '../leaf-icon/leaf-icon';
import { SwipeTracker } from '../../../shared/utils/swipe-tracker';

@Component({
  selector: 'app-species-photo-carousel',
  standalone: true,
  imports: [LeafIconComponent, TranslocoPipe],
  templateUrl: './species-photo-carousel.html',
})
export class SpeciesPhotoCarouselComponent {
  readonly photos = input<string[]>([]);
  readonly altText = input<string>('');
  readonly photoClick = output<number>();

  protected readonly activeIndex = signal(0);
  protected readonly isImageLoading = signal(false);
  protected readonly hasMultiple = computed(() => this.photos().length > 1);
  protected readonly hasPrev = computed(() => this.activeIndex() > 0);
  protected readonly hasNext = computed(() => this.activeIndex() < this.photos().length - 1);

  private readonly _swipeTracker = new SwipeTracker();

  constructor() {
    // Reset index and trigger loading state whenever the photos array changes (new species opened).
    effect(() => {
      const hasPhotos = this.photos().length > 0;
      this.activeIndex.set(0);
      this.isImageLoading.set(hasPhotos);
    });
  }

  protected onImageLoad(): void {
    this.isImageLoading.set(false);
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

  protected onCarouselPointerDown(event: PointerEvent): void {
    this._swipeTracker.onPointerDown(event);
  }

  protected onCarouselPointerUp(event: PointerEvent): void {
    this._swipeTracker.onPointerUp(
      event,
      () => this.prev(),
      () => this.next(),
    );
  }

  protected onCarouselPointerCancel(): void {
    this._swipeTracker.onPointerCancel();
  }
}

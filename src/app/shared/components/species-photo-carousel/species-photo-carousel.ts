import { Component, computed, effect, input, output, signal } from '@angular/core';
import { LeafIconComponent } from '../leaf-icon/leaf-icon';

@Component({
  selector: 'app-species-photo-carousel',
  standalone: true,
  imports: [LeafIconComponent],
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
}

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
  protected readonly hasMultiple = computed(() => this.photos().length > 1);
  protected readonly hasPrev = computed(() => this.activeIndex() > 0);
  protected readonly hasNext = computed(() => this.activeIndex() < this.photos().length - 1);

  constructor() {
    // Reset to first photo whenever the photos array itself changes (new species opened).
    effect(() => {
      this.photos();
      this.activeIndex.set(0);
    });
  }

  protected prev(): void {
    if (this.hasPrev()) this.activeIndex.update((i) => i - 1);
  }

  protected next(): void {
    if (this.hasNext()) this.activeIndex.update((i) => i + 1);
  }
}

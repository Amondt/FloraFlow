import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-scroll-tabs',
  templateUrl: './scroll-tabs.html',
  standalone: true,
  host: { class: 'block' },
})
export class ScrollTabsComponent {
  readonly ariaLabel = input.required<string>();

  private readonly tabsEl = viewChild.required<ElementRef<HTMLElement>>('tabsEl');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canScrollLeft = signal(false);
  protected readonly canScrollRight = signal(false);

  constructor() {
    afterNextRender(() => {
      const el = this.tabsEl().nativeElement;

      const update = (): void => {
        this.canScrollLeft.set(el.scrollLeft > 0);
        this.canScrollRight.set(Math.round(el.scrollLeft + el.clientWidth) < el.scrollWidth);
      };

      update();
      el.addEventListener('scroll', update, { passive: true });

      const ro = new ResizeObserver(update);
      ro.observe(el);

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('scroll', update);
        ro.disconnect();
      });
    });
  }

  protected scrollLeft(): void {
    this.tabsEl().nativeElement.scrollBy({ left: -200, behavior: 'smooth' });
  }

  protected scrollRight(): void {
    this.tabsEl().nativeElement.scrollBy({ left: 200, behavior: 'smooth' });
  }
}

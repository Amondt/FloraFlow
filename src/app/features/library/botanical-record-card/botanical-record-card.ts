import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TagModule } from 'primeng/tag';
import { CachedBotanicalRecord } from '../library.service';
import { FloraTagPT } from '../../../shared/ui/pt/index';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { BotanicalTagsComponent } from '../../../shared/components/botanical-tags/botanical-tags';

@Component({
  selector: 'app-botanical-record-card',
  standalone: true,
  imports: [TagModule, LeafIconComponent, BotanicalTagsComponent],
  templateUrl: './botanical-record-card.html',
})
export class BotanicalRecordCardComponent {
  readonly record = input.required<CachedBotanicalRecord>();
  readonly selected = input<boolean>(false);
  readonly isEnriching = input<boolean>(false);
  readonly varietyCount = input<number>(1);
  readonly cardSelect = output<void>();

  protected readonly FloraTagPT = FloraTagPT;
  protected readonly showLightbox = signal(false);
  private readonly lightboxEl = viewChild<ElementRef<HTMLDivElement>>('lightboxEl');

  constructor() {
    effect(() => {
      if (this.showLightbox()) {
        Promise.resolve().then(() => this.lightboxEl()?.nativeElement.focus());
      }
    });
  }

  protected readonly ariaLabel = computed(() => {
    const r = this.record();
    const count = this.varietyCount();
    const base =
      r.common_name && r.scientific_name
        ? `${r.common_name}, scientific name ${r.scientific_name}`
        : (r.common_name ?? r.scientific_name ?? 'Unknown species');
    return count > 1 ? `${base}, ${count} varieties` : base;
  });

  protected readonly rankBadge = computed((): string | null => {
    switch (this.record().inat_rank) {
      case 'subspecies':
        return 'Subspecies';
      case 'variety':
        return 'Variety';
      case 'form':
        return 'Form';
      case 'hybrid':
      case 'genushybrid':
        return 'Hybrid';
      default:
        return null;
    }
  });

  protected onSpaceKey(event: Event): void {
    event.preventDefault();
    this.cardSelect.emit();
  }
}

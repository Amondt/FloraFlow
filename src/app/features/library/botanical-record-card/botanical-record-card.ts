import { Component, computed, inject, input, output, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../../core/services/locale.service';
import { CachedBotanicalRecord } from '../library.service';
import { FloraTagPT } from '../../../shared/ui/pt/index';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { BotanicalTagsComponent } from '../../../shared/components/botanical-tags/botanical-tags';
import { PhotoLightboxDialogComponent } from '../../../shared/components/photo-lightbox-dialog/photo-lightbox-dialog';
import { buildGalleryPhotos } from '../../../shared/utils/botanical-photo.util';

@Component({
  selector: 'app-botanical-record-card',
  standalone: true,
  imports: [
    TagModule,
    TranslocoPipe,
    LeafIconComponent,
    BotanicalTagsComponent,
    PhotoLightboxDialogComponent,
  ],
  templateUrl: './botanical-record-card.html',
})
export class BotanicalRecordCardComponent {
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);

  readonly record = input.required<CachedBotanicalRecord>();
  readonly selected = input<boolean>(false);
  readonly isEnriching = input<boolean>(false);
  readonly varietyCount = input<number>(1);
  readonly cardSelect = output<void>();

  protected readonly FloraTagPT = FloraTagPT;
  protected readonly showLightbox = signal(false);
  protected readonly galleryPhotos = computed(() => buildGalleryPhotos(this.record()));

  protected readonly ariaLabel = computed(() => {
    const _lang = this.localeService.locale();
    const r = this.record();
    const count = this.varietyCount();
    const sciLabel = this.t.translate('library.card.scientificName');
    const base =
      r.common_name && r.scientific_name
        ? `${r.common_name}, ${sciLabel} ${r.scientific_name}`
        : (r.common_name ?? r.scientific_name ?? 'Unknown species');
    return count > 1 ? this.t.translate('library.card.varieties', { count }) + ` — ${base}` : base;
  });

  protected readonly rankBadge = computed((): string | null => {
    const _lang = this.localeService.locale();
    switch (this.record().inat_rank) {
      case 'subspecies':
        return this.t.translate('library.card.rankSubspecies');
      case 'variety':
        return this.t.translate('library.card.rankVariety');
      case 'form':
        return this.t.translate('library.card.rankForm');
      case 'hybrid':
      case 'genushybrid':
        return this.t.translate('library.card.rankHybrid');
      default:
        return null;
    }
  });

  protected onSpaceKey(event: Event): void {
    event.preventDefault();
    this.cardSelect.emit();
  }
}

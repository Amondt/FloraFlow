import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../../core/services/locale.service';
import { FloraFormDialogPT, FloraButtonPT, FloraMessagePT, FLORA_FOCUS } from '../../ui/pt/index';
import {
  PlantIdentifierService,
  InvalidPlantImageError,
  type BotanicalCacheRow,
  type PlantIdCandidate,
  type PlantIdResult,
} from '../../../core/services/plant-identifier.service';
import { LibraryService } from '../../../features/library/library.service';
import { blurActiveElement } from '../../utils/dom';
import {
  getConfidenceBadgeClass,
  getConfidenceBadgeKeyAndParams,
  getConfidenceBadgeLabel,
} from '../../utils/plant-identifier.util';
import { EnrichmentPoll } from '../../utils/enrichment-poll';
import { LeafIconComponent } from '../leaf-icon/leaf-icon';
import { BotanicalTagsComponent } from '../botanical-tags/botanical-tags';

export interface PlantIdentifiedEvent {
  common_name: string;
  scientific_name: string;
  inat_taxon_id: number | null;
  confidence_score: number;
}

type IdentState = 'idle' | 'loading' | 'result' | 'error';
type IdentErrorKind = 'invalid-image' | 'api-error';

@Component({
  selector: 'app-plant-identifier-dialog',
  standalone: true,
  imports: [
    DialogModule,
    ButtonModule,
    MessageModule,
    TranslocoPipe,
    LeafIconComponent,
    BotanicalTagsComponent,
  ],
  templateUrl: './plant-identifier-dialog.html',
})
export class PlantIdentifierDialogComponent {
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  private readonly identifierService = inject(PlantIdentifierService);
  private readonly _libraryService = inject(LibraryService);
  private readonly _poll = new EnrichmentPoll();

  readonly visible = model<boolean>(false);
  readonly mode = input<'identify' | 'prefill' | 'browse'>('identify');
  readonly identified = output<PlantIdentifiedEvent>();
  readonly addToPlants = output<PlantIdentifiedEvent>();

  protected readonly FloraFormDialogPT = FloraFormDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FLORA_FOCUS = FLORA_FOCUS;

  protected readonly photoInputRef = viewChild<ElementRef<HTMLInputElement>>('photoInputRef');

  readonly identState = signal<IdentState>('idle');
  private readonly identErrorKind = signal<IdentErrorKind>('api-error');
  readonly identResult = signal<PlantIdResult | null>(null);
  readonly activeMatch = signal<PlantIdCandidate | null>(null);
  readonly candidateRecords = signal<Map<string, BotanicalCacheRow | null>>(new Map());
  readonly isDragOver = signal(false);
  readonly uploadedPhotoUrl = signal<string | null>(null);
  readonly showPhotoLightbox = signal(false);

  // Enrichment — exposed as readonly for template skeleton state
  protected readonly enrichingNames = this._poll.enrichingNames;
  protected readonly isEnrichingCandidates = computed(() => this._poll.enrichingCount() > 0);

  protected readonly isPrimaryMatch = computed(() => {
    const active = this.activeMatch();
    const primary = this.identResult()?.species_match;
    return active?.scientific_name === primary?.scientific_name;
  });

  protected readonly allCandidates = computed((): PlantIdCandidate[] => {
    const result = this.identResult();
    if (!result?.species_match) return [];
    return [result.species_match, ...result.alternative_candidates];
  });

  protected readonly emittableInatTaxonId = computed(() => {
    const match = this.activeMatch();
    if (!match) return null;
    // Prefer the cached botanical record's inat_taxon_id — populated by fetchCandidateRecords
    // (and updated reactively by the enrichment poll). This recovers the taxon link even when
    // claude-plant-id failed to resolve it, and works for both primary and alternative candidates.
    const record = this.candidateRecords().get(match.scientific_name);
    if (record?.inat_taxon_id) return record.inat_taxon_id;
    // Fallback: use the AI result's taxon id, but only for the primary match (the result only
    // carries one top-level inat_taxon_id which corresponds to the primary species).
    return this.isPrimaryMatch() ? (this.identResult()?.inat_taxon_id ?? null) : null;
  });

  protected readonly confidenceBadgeClass = computed(() =>
    getConfidenceBadgeClass(this.activeMatch()?.confidence_score ?? 0),
  );

  protected readonly confidenceBadgeLabel = computed(() => {
    const _lang = this.localeService.locale();
    const { key, params } = getConfidenceBadgeKeyAndParams(
      this.activeMatch()?.confidence_score ?? 0,
    );
    return this.t.translate(key, params);
  });

  protected readonly errorMessage = computed(() => {
    const _lang = this.localeService.locale();
    return this.identErrorKind() === 'invalid-image'
      ? this.t.translate('botanical.identifier.errorInvalidImage')
      : this.t.translate('botanical.identifier.errorApi');
  });

  protected candidateChipBadgeClass(score: number): string {
    return getConfidenceBadgeClass(score);
  }

  protected candidateChipBadgeLabel(score: number): string {
    return getConfidenceBadgeLabel(score, false);
  }

  protected triggerPhotoInput(): void {
    this.photoInputRef()?.nativeElement.click();
  }

  async onFileChange(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    if (!file) return;
    inputEl.value = '';
    await this.runIdentification(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (!file) return;
    await this.runIdentification(file);
  }

  private async runIdentification(file: File): Promise<void> {
    const prevUrl = this.uploadedPhotoUrl();
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    this.uploadedPhotoUrl.set(URL.createObjectURL(file));
    this.identState.set('loading');
    this.identResult.set(null);
    this.activeMatch.set(null);

    try {
      const result = await this.identifierService.identify(file);
      this.identResult.set(result);
      this.activeMatch.set(result.species_match);
      this.identState.set('result');

      // Collect candidates before entering .then — avoids reading signals in async context
      const allCandidates = [result.species_match, ...result.alternative_candidates];
      this.identifierService
        .fetchCandidateRecords(allCandidates.map((c) => c.scientific_name))
        .then((map) => {
          this.candidateRecords.set(map);
          this._startEnrichmentIfNeeded(allCandidates, map);
        })
        .catch((err) => console.warn('plant-identifier: candidate record fetch failed:', err));
    } catch (err) {
      this.identErrorKind.set(
        err instanceof InvalidPlantImageError ? 'invalid-image' : 'api-error',
      );
      this.identState.set('error');
    }
  }

  private _startEnrichmentIfNeeded(
    allCandidates: PlantIdCandidate[],
    recordMap: Map<string, BotanicalCacheRow | null>,
  ): void {
    const candidateByName = new Map(allCandidates.map((c) => [c.scientific_name, c]));

    const pendingNames = allCandidates
      .map((c) => c.scientific_name)
      .filter((name) => {
        const r = recordMap.get(name);
        return r == null || !r.is_ai_enriched || !r.thumbnail_fetched;
      });

    if (pendingNames.length === 0) return;

    const enrichmentTargets = pendingNames.map((name) => {
      const r = recordMap.get(name);
      return {
        scientific_name: name,
        common_name: r?.common_name ?? candidateByName.get(name)?.common_name ?? name,
      };
    });

    this._poll.start(pendingNames, async (pending) => {
      const refreshed = await this._libraryService.refetchByScientificNames(pending);
      if (refreshed.length > 0) {
        this.candidateRecords.update((current) => {
          const next = new Map(current);
          for (const r of refreshed) next.set(r.scientific_name, r);
          return next;
        });
      }
      return new Set(
        pending.filter((name) => {
          const r = refreshed.find((row) => row.scientific_name === name);
          return !r || !r.is_ai_enriched || !r.thumbnail_fetched;
        }),
      );
    });

    void this._libraryService.triggerEnrichment(enrichmentTargets, this._poll.controller?.signal);
  }

  protected selectAlternative(candidate: PlantIdCandidate): void {
    this.activeMatch.set(candidate);
  }

  protected viewProfile(): void {
    const match = this.activeMatch();
    if (!match) return;
    this.identified.emit({
      common_name: match.common_name,
      scientific_name: match.scientific_name,
      inat_taxon_id: this.emittableInatTaxonId(),
      confidence_score: match.confidence_score,
    });
  }

  protected addToMyPlants(): void {
    const match = this.activeMatch();
    if (!match) return;
    this.addToPlants.emit({
      common_name: match.common_name,
      scientific_name: match.scientific_name,
      inat_taxon_id: this.emittableInatTaxonId(),
      confidence_score: match.confidence_score,
    });
  }

  protected tryAnother(): void {
    this.resetDialog();
  }

  onVisibleChange(v: boolean): void {
    if (!v) {
      blurActiveElement();
      this.resetDialog();
    }
    this.visible.set(v);
  }

  private resetDialog(): void {
    this._poll.stop();
    const url = this.uploadedPhotoUrl();
    if (url) URL.revokeObjectURL(url);
    this.uploadedPhotoUrl.set(null);
    this.showPhotoLightbox.set(false);
    this.identState.set('idle');
    this.identErrorKind.set('api-error');
    this.identResult.set(null);
    this.activeMatch.set(null);
    this.candidateRecords.set(new Map());
    this.isDragOver.set(false);
    const photoEl = this.photoInputRef()?.nativeElement;
    if (photoEl) photoEl.value = '';
  }
}

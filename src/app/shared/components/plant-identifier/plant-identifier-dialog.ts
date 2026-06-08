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
import { FloraFormDialogPT, FloraButtonPT, FloraMessagePT, FLORA_FOCUS } from '../../ui/pt/index';
import {
  PlantIdentifierService,
  InvalidPlantImageError,
  type BotanicalCacheRow,
  type PlantIdCandidate,
  type PlantIdResult,
} from '../../../core/services/plant-identifier.service';
import { blurActiveElement } from '../../utils/dom';
import {
  getConfidenceBadgeClass,
  getConfidenceBadgeLabel,
} from '../../utils/plant-identifier.util';
import { LeafIconComponent } from '../leaf-icon/leaf-icon';

export interface PlantIdentifiedEvent {
  common_name: string;
  scientific_name: string;
  perenual_id: number | null;
  confidence_score: number;
}

type IdentState = 'idle' | 'loading' | 'result' | 'error';
type IdentErrorKind = 'invalid-image' | 'api-error';

@Component({
  selector: 'app-plant-identifier-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, MessageModule, LeafIconComponent],
  templateUrl: './plant-identifier-dialog.html',
})
export class PlantIdentifierDialogComponent {
  private readonly identifierService = inject(PlantIdentifierService);

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

  protected readonly emittablePerenualId = computed(() =>
    this.isPrimaryMatch() ? (this.identResult()?.perenual_id ?? null) : null,
  );

  protected readonly confidenceBadgeClass = computed(() =>
    getConfidenceBadgeClass(this.activeMatch()?.confidence_score ?? 0),
  );

  protected readonly confidenceBadgeLabel = computed(() =>
    getConfidenceBadgeLabel(this.activeMatch()?.confidence_score ?? 0),
  );

  protected readonly errorMessage = computed(() =>
    this.identErrorKind() === 'invalid-image'
      ? "The image doesn't appear to show a plant. Try a clear photo of a leaf or stem."
      : 'Identification service unavailable — try again in a moment.',
  );

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

      // Collect names before entering the .then callback — avoids reading signals in async context
      const allCandidateNames = [result.species_match, ...result.alternative_candidates].map(
        (c) => c.scientific_name,
      );
      this.identifierService
        .fetchCandidateRecords(allCandidateNames)
        .then((map) => this.candidateRecords.set(map))
        .catch((err) => console.warn('plant-identifier: candidate record fetch failed:', err));
    } catch (err) {
      this.identErrorKind.set(
        err instanceof InvalidPlantImageError ? 'invalid-image' : 'api-error',
      );
      this.identState.set('error');
    }
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
      perenual_id: this.emittablePerenualId(),
      confidence_score: match.confidence_score,
    });
  }

  protected addToMyPlants(): void {
    const match = this.activeMatch();
    if (!match) return;
    this.addToPlants.emit({
      common_name: match.common_name,
      scientific_name: match.scientific_name,
      perenual_id: this.emittablePerenualId(),
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

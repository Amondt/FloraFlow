import { Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { FloraTagPT } from '../../ui/pt/index';

/**
 * Presentational component that renders botanical trait tags (Indoor, Outdoor,
 * Tropical, toxicity, care difficulty, upkeep) consistently across the app.
 *
 * Uses `display: contents` on the host so the `<p-tag>` children participate
 * directly in the parent's flex-wrap container — no extra DOM wrapper needed.
 */
@Component({
  selector: 'app-botanical-tags',
  standalone: true,
  imports: [TagModule],
  templateUrl: './botanical-tags.html',
  host: { class: 'contents' },
})
export class BotanicalTagsComponent {
  readonly placement = input<string | null>(null);
  readonly isTropical = input<boolean | null>(null);
  readonly isToxicToPets = input<boolean | null>(null);
  readonly isToxicToHumans = input<boolean | null>(null);
  readonly careDifficulty = input<string | null>(null);
  readonly maintenanceLevel = input<string | null>(null);
  /** When true and no data is populated yet, renders animated skeleton pills. */
  readonly isEnriching = input<boolean>(false);

  protected readonly FloraTagPT = FloraTagPT;

  /** Show skeleton pills only when actively enriching and nothing has populated yet. */
  protected readonly shouldShowSkeleton = computed(
    () =>
      this.isEnriching() &&
      this.isToxicToPets() === null &&
      this.isTropical() === null &&
      !this.placement() &&
      !this.careDifficulty() &&
      !this.maintenanceLevel(),
  );
}

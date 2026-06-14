import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../../core/services/locale.service';
import { CATEGORY_ICON, CATEGORY_KEY, type LogCategoryType } from '../journal-categories';
import {
  JournalService,
  type JournalEntryWithPlant,
  type LeafDoctorDiagnostics,
  type HealthyDiagnosticsBlob,
} from '../journal.service';
import { LeafDoctorBadgesComponent } from '../leaf-doctor-badges/leaf-doctor-badges';
import {
  localizeDiagnostics,
  hasDiagnosticsTranslation,
} from '../../../shared/utils/localize-diagnostics.util';

const BADGE_BASE =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-display';

const CATEGORY_COLOR: Record<LogCategoryType, string> = {
  Observation: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
  Watering: 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  Pruning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Repotting: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Fertilization: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PestTreatment: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const CATEGORY_ICON_BOX_BG: Record<LogCategoryType, string> = {
  Observation: 'bg-neutral-100 dark:bg-neutral-700/40',
  Watering: 'bg-primary-50 dark:bg-primary-900/30',
  Pruning: 'bg-yellow-50 dark:bg-yellow-900/20',
  Repotting: 'bg-green-50 dark:bg-green-900/20',
  Fertilization: 'bg-green-50 dark:bg-green-900/20',
  PestTreatment: 'bg-red-50 dark:bg-red-900/20',
};

const CATEGORY_ICON_COLOR: Record<LogCategoryType, string> = {
  Observation: 'text-neutral-500 dark:text-neutral-400',
  Watering: 'text-primary-600 dark:text-primary-400',
  Pruning: 'text-yellow-600 dark:text-yellow-400',
  Repotting: 'text-green-600 dark:text-green-400',
  Fertilization: 'text-green-600 dark:text-green-400',
  PestTreatment: 'text-red-600 dark:text-red-400',
};

@Component({
  selector: 'app-journal-entry-card',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, LeafDoctorBadgesComponent],
  templateUrl: './journal-entry-card.html',
})
export class JournalEntryCardComponent {
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  private readonly journalService = inject(JournalService);
  readonly entry = input.required<JournalEntryWithPlant>();
  readonly imageUrl = input.required<string | null>();
  readonly editRequested = output<void>();
  readonly deleteRequested = output<void>();

  protected readonly showDiagnostics = signal(false);
  protected readonly showLightbox = signal(false);
  protected readonly isTranslating = signal(false);
  private readonly lightboxEl = viewChild<ElementRef<HTMLDivElement>>('lightboxEl');
  private readonly _translationTriggered = new Set<string>();

  constructor() {
    effect(() => {
      if (this.showLightbox()) {
        Promise.resolve().then(() => this.lightboxEl()?.nativeElement.focus());
      }
    });

    effect(() => {
      const locale = this.localeService.locale();
      if (locale === 'en') return;
      const diag = this.diagnostics();
      if (!diag) return;
      if (hasDiagnosticsTranslation(this.entry().diagnostics_i18n, locale)) return;
      const key = `${this.entry().id}:${locale}`;
      if (this._translationTriggered.has(key)) return;
      this._translationTriggered.add(key);
      this.isTranslating.set(true);
      void this.journalService
        .translateDiagnostics(this.entry().id, diag, locale)
        .finally(() => this.isTranslating.set(false));
    });
  }

  protected readonly diagnostics = computed(
    () => this.entry().diagnostics as LeafDoctorDiagnostics | HealthyDiagnosticsBlob | null,
  );

  protected readonly localizedDiagnostics = computed(() => {
    const locale = this.localeService.locale();
    return localizeDiagnostics(this.diagnostics(), this.entry().diagnostics_i18n, locale);
  });

  protected readonly isHealthyEntry = computed(() => {
    const d = this.diagnostics();
    return d !== null && 'is_healthy' in d && (d as HealthyDiagnosticsBlob).is_healthy === true;
  });

  protected readonly sickDiagnostics = computed((): LeafDoctorDiagnostics | null => {
    const d = this.diagnostics();
    if (!d || this.isHealthyEntry()) return null;
    return d as LeafDoctorDiagnostics;
  });

  protected readonly localizedSickDiagnostics = computed((): LeafDoctorDiagnostics | null => {
    const d = this.localizedDiagnostics();
    if (!d || this.isHealthyEntry()) return null;
    return d as LeafDoctorDiagnostics;
  });

  protected readonly localizedHealthyIdentifiedPlant = computed((): string | null => {
    if (!this.isHealthyEntry()) return null;
    return (this.localizedDiagnostics() as HealthyDiagnosticsBlob | null)?.identified_plant ?? null;
  });

  protected readonly speciesMismatchWarning = computed((): string | null => {
    const d = this.sickDiagnostics();
    return d?.species_mismatch_name ?? null;
  });

  protected toggleDiagnostics(): void {
    this.showDiagnostics.update((v) => !v);
  }

  protected readonly badgeClasses = computed(
    () => `${BADGE_BASE} ${CATEGORY_COLOR[this.entry().category]}`,
  );

  protected readonly categoryLabel = computed(() => {
    const _lang = this.localeService.locale();
    return this.t.translate(CATEGORY_KEY[this.entry().category]);
  });

  protected readonly iconBoxClass = computed(() => CATEGORY_ICON_BOX_BG[this.entry().category]);

  protected readonly categoryIconClass = computed(
    () =>
      `${CATEGORY_ICON[this.entry().category]} text-xl ${CATEGORY_ICON_COLOR[this.entry().category]}`,
  );

  protected readonly formattedWhen = computed(() => {
    const lang = this.localeService.locale();
    const d = new Date(this.entry().logged_at);
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const locale = lang === 'nl' ? 'nl-NL' : lang === 'fr' ? 'fr-FR' : 'en-GB';

    if (d.toDateString() === todayStr) {
      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return this.t.translate('journal.entryCard.yesterday');
    }
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  });
}

import { Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CATEGORY_ICON, CATEGORY_LABEL, type LogCategoryType } from '../journal-categories';
import { type JournalEntryWithPlant, type LeafDoctorDiagnostics } from '../journal.service';
import { confidenceBadgeClass, confidenceBadgeLabel, riskBadgeClass } from '../leaf-doctor.utils';
import { FLORA_FOCUS } from '../../../shared/ui/pt/index';

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

const ICON_BASE = 'text-xl text-primary-600 dark:text-primary-400';

@Component({
  selector: 'app-journal-entry-card',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './journal-entry-card.html',
})
export class JournalEntryCardComponent {
  readonly entry = input.required<JournalEntryWithPlant>();
  readonly imageUrl = input.required<string | null>();

  protected readonly showDiagnostics = signal(false);
  protected readonly diagnostics = computed(
    () => this.entry().diagnostics as LeafDoctorDiagnostics | null,
  );

  protected readonly FLORA_FOCUS = FLORA_FOCUS;
  protected readonly confidenceBadgeClass = confidenceBadgeClass;
  protected readonly confidenceBadgeLabel = confidenceBadgeLabel;
  protected readonly riskBadgeClass = riskBadgeClass;

  protected toggleDiagnostics(): void {
    this.showDiagnostics.update((v) => !v);
  }

  protected readonly badgeClasses = computed(
    () => `${BADGE_BASE} ${CATEGORY_COLOR[this.entry().category]}`,
  );

  protected readonly categoryLabel = computed(() => CATEGORY_LABEL[this.entry().category]);

  protected readonly categoryIconClass = computed(
    () => `${CATEGORY_ICON[this.entry().category]} ${ICON_BASE}`,
  );

  protected readonly formattedWhen = computed(() => {
    const d = new Date(this.entry().logged_at);
    const todayStr = new Date().toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === todayStr) {
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  });
}

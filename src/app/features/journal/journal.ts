import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { MessageService } from 'primeng/api';
import {
  FloraButtonPT,
  FloraSelectPT,
  FloraToastPT,
  FloraSkeletonPT,
  FloraMessagePT,
  FLORA_FOCUS,
} from '../../shared/ui/pt/index';
import { PlantService } from '../scheduler/plant.service';
import { JournalService, type JournalEntryWithPlant } from './journal.service';
import { JournalEntryFormComponent } from './journal-entry-form/journal-entry-form';
import { JournalEntryCardComponent } from './journal-entry-card/journal-entry-card';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_OPTIONS,
  type LogCategoryType,
} from './journal-categories';

type ResolvedEntry = JournalEntryWithPlant & { imageUrl: string | null };

type DayGroup = {
  dateKey: string;
  dayNumber: number;
  monthYear: string;
  entries: ResolvedEntry[];
};

type FilterOption = { label: string; value: LogCategoryType | null; icon: string | null };

const CATEGORY_FILTER_OPTIONS: FilterOption[] = [
  { label: 'All', value: null, icon: null },
  ...CATEGORY_OPTIONS.map((opt) => ({ ...opt, icon: CATEGORY_ICON[opt.value] })),
];

const TAB_BASE = `inline-flex items-center gap-1.5 px-3.5 py-2.5 text-[0.8125rem] font-semibold font-display border-b-2 -mb-px shrink-0 whitespace-nowrap transition-colors duration-150 ${FLORA_FOCUS}`;
const TAB_ACTIVE = 'border-primary-500 text-primary-700 dark:text-primary-400';
const TAB_INACTIVE =
  'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200';

const TAB_COUNT_ACTIVE =
  'font-mono text-[0.7rem] px-1.5 py-px rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
const TAB_COUNT_INACTIVE =
  'font-mono text-[0.7rem] px-1.5 py-px rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    SelectModule,
    ToastModule,
    SkeletonModule,
    MessageModule,
    JournalEntryFormComponent,
    JournalEntryCardComponent,
  ],
  providers: [MessageService],
  templateUrl: './journal.html',
})
export class JournalComponent {
  private readonly plantService = inject(PlantService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  protected readonly journalService = inject(JournalService);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly categoryFilterOptions = CATEGORY_FILTER_OPTIONS;
  protected readonly skeletonItems = [1, 2, 3];

  readonly plant = input<string | undefined>(undefined);

  readonly dialogVisible = signal(false);
  readonly selectedCategory = signal<LogCategoryType | null>(null);
  readonly selectedPlant = linkedSignal<string | null>(() => this.plant() ?? null);

  readonly hasPlants = computed(() => this.plantService.plants().length > 0);
  readonly loading = computed(() => this.plantService.loading());

  readonly plantFilterOptions = computed(() => {
    const entryPlantIds = new Set(this.journalService.entries().map((e) => e.plant_id));
    return this.plantService.plants().filter((p) => entryPlantIds.has(p.id));
  });

  readonly plantSelectOptions = computed(() => [
    { label: 'All plants', value: null as string | null },
    ...this.plantFilterOptions().map((p) => ({ label: p.common_name, value: p.id })),
  ]);

  private readonly entriesFilteredByPlant = computed(() => {
    const plant = this.selectedPlant();
    return plant === null
      ? this.journalService.entries()
      : this.journalService.entries().filter((e) => e.plant_id === plant);
  });

  readonly filteredEntries = computed(() => {
    const cat = this.selectedCategory();
    return cat === null
      ? this.entriesFilteredByPlant()
      : this.entriesFilteredByPlant().filter((e) => e.category === cat);
  });

  private readonly resolvedEntries = computed<ResolvedEntry[]>(() =>
    this.filteredEntries().map((e) => ({
      ...e,
      imageUrl: e.image_storage_path
        ? this.journalService.getPublicUrl(e.image_storage_path)
        : null,
    })),
  );

  readonly entriesByDay = computed((): DayGroup[] => {
    const groups = new Map<string, DayGroup>();
    for (const entry of this.resolvedEntries()) {
      const d = new Date(entry.logged_at);
      const key = d.toDateString();
      const existing = groups.get(key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.set(key, {
          dateKey: key,
          dayNumber: d.getDate(),
          monthYear: d.toLocaleString('en-GB', { month: 'short', year: 'numeric' }).toUpperCase(),
          entries: [entry],
        });
      }
    }
    return [...groups.values()];
  });

  readonly selectedCategoryLabel = computed(() => {
    const cat = this.selectedCategory();
    return cat ? CATEGORY_LABEL[cat] : null;
  });

  constructor() {
    if (this.plantService.plants().length === 0) {
      void this.plantService.loadPlants();
    }
    void this.journalService.loadEntries();
  }

  openDialog(): void {
    this.dialogVisible.set(true);
  }

  onEntrySaved(): void {
    void this.journalService.loadEntries();
  }

  protected onPlantFilterChange(id: string | null): void {
    this.selectedPlant.set(id);
    void this.router.navigate([], {
      queryParams: { plant: id },
      queryParamsHandling: 'merge',
    });
  }

  protected clearFilters(): void {
    this.selectedCategory.set(null);
    this.onPlantFilterChange(null);
  }

  protected getEntryCount(value: LogCategoryType | null): number {
    if (value === null) return this.entriesFilteredByPlant().length;
    return this.entriesFilteredByPlant().filter((e) => e.category === value).length;
  }

  protected getTabClass(value: LogCategoryType | null): string {
    return `${TAB_BASE} ${this.selectedCategory() === value ? TAB_ACTIVE : TAB_INACTIVE}`;
  }

  protected getTabCountClass(value: LogCategoryType | null): string {
    return this.selectedCategory() === value ? TAB_COUNT_ACTIVE : TAB_COUNT_INACTIVE;
  }

  protected getDayGroupClass(first: boolean): string {
    const base = 'flex gap-4 py-4';
    return first ? base : `${base} border-t border-neutral-200 dark:border-neutral-700`;
  }
}

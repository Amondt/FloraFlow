import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../core/services/locale.service';
import {
  FloraToastPT,
  FloraSkeletonPT,
  FloraMessagePT,
  FloraConfirmDialogPT,
} from '../../shared/ui/pt/index';
import {
  PlantSelectComponent,
  type PlantOption,
  type PlantOptionGroup,
} from '../../shared/components/plant-select/plant-select';
import { PlantService } from '../tasks/plant.service';
import { ZoneService } from '../dashboard/zone.service';
import { PlantThumbnailService } from '../../core/services/plant-thumbnail.service';
import { JournalService, type JournalEntryWithPlant } from './journal.service';
import { JournalEntryFormComponent } from './journal-entry-form/journal-entry-form';
import { JournalEntryCardComponent } from './journal-entry-card/journal-entry-card';
import { LeafDoctorDialogComponent } from './leaf-doctor-dialog/leaf-doctor-dialog';
import {
  CATEGORY_ICON,
  CATEGORY_KEY,
  CATEGORY_OPTIONS,
  type LogCategoryType,
} from './journal-categories';
import { tabClass, tabCountClass } from '../../shared/utils/tab-styles.util';

type ResolvedEntry = JournalEntryWithPlant & { imageUrl: string | null };

type DayGroup = {
  dateKey: string;
  dayNumber: number;
  monthYear: string;
  entries: ResolvedEntry[];
};

type FilterOption = { labelKey: string; value: LogCategoryType | null; icon: string | null };

const CATEGORY_FILTER_OPTIONS: FilterOption[] = [
  { labelKey: 'journal.category.all', value: null, icon: null },
  ...CATEGORY_OPTIONS.map((opt) => ({
    labelKey: CATEGORY_KEY[opt.value],
    value: opt.value,
    icon: CATEGORY_ICON[opt.value],
  })),
];

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    FormsModule,
    ToastModule,
    SkeletonModule,
    PlantSelectComponent,
    MessageModule,
    ConfirmDialogModule,
    TranslocoPipe,
    JournalEntryFormComponent,
    JournalEntryCardComponent,
    LeafDoctorDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './journal.html',
})
export class JournalComponent {
  private readonly plantService = inject(PlantService);
  private readonly zoneService = inject(ZoneService);
  private readonly plantThumbnailService = inject(PlantThumbnailService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  protected readonly journalService = inject(JournalService);

  protected readonly FloraToastPT = FloraToastPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly categoryFilterOptions = CATEGORY_FILTER_OPTIONS;
  protected readonly skeletonItems = [1, 2, 3];

  readonly plant = input<string | undefined>(undefined);

  readonly dialogVisible = signal(false);
  readonly editingEntry = signal<JournalEntryWithPlant | null>(null);
  readonly diagnosisDialogVisible = signal(false);
  readonly selectedCategory = signal<LogCategoryType | null>(null);
  readonly selectedPlant = linkedSignal<string | null>(() => this.plant() ?? null);

  readonly hasPlants = computed(() => this.plantService.plants().length > 0);
  readonly loading = computed(() => this.plantService.loading());

  readonly plantSelectOptions = computed((): PlantOptionGroup[] => {
    const _lang = this.localeService.locale();
    const plants = this.plantService.plants();
    const zones = this.zoneService.zones();
    const thumbnailMap = this.plantThumbnailService.thumbnailMap();

    const entryCounts = new Map<string, number>();
    for (const e of this.journalService.entries()) {
      entryCounts.set(e.plant_id, (entryCounts.get(e.plant_id) ?? 0) + 1);
    }

    const allPlantsGroup: PlantOptionGroup = {
      label: '',
      items: [{ label: this.t.translate('journal.allPlants'), value: null, scientificName: null }],
    };

    const groups = new Map<string, PlantOptionGroup>(
      zones.map((z) => [z.id, { label: z.name, items: [] }]),
    );
    const ungrouped: PlantOption[] = [];

    for (const p of plants) {
      const option: PlantOption = {
        label: p.common_name,
        value: p.id,
        scientificName: p.scientific_name,
        thumbnailUrl: p.scientific_name ? (thumbnailMap.get(p.scientific_name) ?? null) : null,
        count: entryCounts.get(p.id),
      };
      const group = groups.get(p.zone_id);
      if (group) {
        group.items.push(option);
      } else {
        ungrouped.push(option);
      }
    }

    const result: PlantOptionGroup[] = [allPlantsGroup];
    result.push(...[...groups.values()].filter((g) => g.items.length > 0));
    if (ungrouped.length > 0) {
      result.push({ label: this.t.translate('journal.otherGroup'), items: ungrouped });
    }
    return result;
  });

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
    const lang = this.localeService.locale();
    const bcp47 = lang === 'nl' ? 'nl-NL' : lang === 'fr' ? 'fr-FR' : 'en-GB';
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
          monthYear: d.toLocaleString(bcp47, { month: 'short', year: 'numeric' }).toUpperCase(),
          entries: [entry],
        });
      }
    }
    return [...groups.values()];
  });

  readonly selectedCategoryLabel = computed(() => {
    const _lang = this.localeService.locale();
    const cat = this.selectedCategory();
    return cat ? this.t.translate(CATEGORY_KEY[cat]) : null;
  });

  constructor() {
    if (this.plantService.plants().length === 0) {
      void this.plantService.loadPlants();
    }
    if (this.zoneService.zones().length === 0) {
      void this.zoneService.loadZones();
    }
    void this.journalService.loadEntries();
  }

  openDialog(): void {
    this.editingEntry.set(null);
    this.dialogVisible.set(true);
  }

  onEditRequested(entry: JournalEntryWithPlant): void {
    this.editingEntry.set(entry);
    this.dialogVisible.set(true);
  }

  onDeleteRequested(entry: JournalEntryWithPlant): void {
    this.confirmationService.confirm({
      message: this.t.translate('journal.confirm.deleteMessage', {
        category: this.t.translate(CATEGORY_KEY[entry.category]),
        plant: entry.plants.common_name,
      }),
      header: this.t.translate('journal.confirm.deleteHeader'),
      acceptLabel: this.t.translate('journal.confirm.deleteAccept'),
      rejectLabel: this.t.translate('journal.confirm.deleteReject'),
      accept: () => void this.executeDelete(entry),
    });
  }

  private async executeDelete(entry: JournalEntryWithPlant): Promise<void> {
    try {
      await this.journalService.deleteEntry(entry.id);
      await this.journalService.loadEntries();
      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('journal.toast.deleteSuccess'),
        detail: this.t.translate('journal.toast.deleteSuccessDetail'),
      });
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('journal.toast.deleteFailed'),
        detail: e instanceof Error ? e.message : 'Unexpected error.',
      });
    }
  }

  openDiagnosisDialog(): void {
    this.diagnosisDialogVisible.set(true);
  }

  onEntrySaved(): void {
    this.editingEntry.set(null);
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
    return tabClass(this.selectedCategory() === value);
  }

  protected getTabCountClass(value: LogCategoryType | null): string {
    return tabCountClass(this.selectedCategory() === value);
  }

  protected getDayGroupClass(first: boolean): string {
    const base = 'flex gap-4 py-4';
    return first ? base : `${base} border-t border-neutral-200 dark:border-neutral-700`;
  }
}

import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageModule } from 'primeng/message';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import {
  FloraButtonPT,
  FloraToastPT,
  FloraSkeletonPT,
  FloraMessagePT,
  FloraConfirmDialogPT,
} from '../../shared/ui/pt/index';
import { PlantSelectComponent } from '../../shared/components/plant-select/plant-select';
import { PlantService } from '../tasks/plant.service';
import { JournalService, type JournalEntryWithPlant } from './journal.service';
import { JournalEntryFormComponent } from './journal-entry-form/journal-entry-form';
import { JournalEntryCardComponent } from './journal-entry-card/journal-entry-card';
import { LeafDoctorDialogComponent } from './leaf-doctor-dialog/leaf-doctor-dialog';
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
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

type FilterOption = { label: string; value: LogCategoryType | null; icon: string | null };

const CATEGORY_FILTER_OPTIONS: FilterOption[] = [
  { label: 'All', value: null, icon: null },
  ...CATEGORY_OPTIONS.map((opt) => ({ ...opt, icon: CATEGORY_ICON[opt.value] })),
];

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [
    FormsModule,
    ButtonModule,
    ToastModule,
    SkeletonModule,
    PlantSelectComponent,
    MessageModule,
    ConfirmDialogModule,
    JournalEntryFormComponent,
    JournalEntryCardComponent,
    LeafDoctorDialogComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './journal.html',
})
export class JournalComponent {
  private readonly plantService = inject(PlantService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  protected readonly journalService = inject(JournalService);

  protected readonly FloraButtonPT = FloraButtonPT;
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

  readonly plantSelectOptions = computed(() => [
    { label: 'All plants', value: null as string | null, scientificName: null as string | null },
    ...this.plantService.plants().map((p) => ({
      label: p.common_name,
      value: p.id,
      scientificName: p.scientific_name,
    })),
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
    this.editingEntry.set(null);
    this.dialogVisible.set(true);
  }

  onEditRequested(entry: JournalEntryWithPlant): void {
    this.editingEntry.set(entry);
    this.dialogVisible.set(true);
  }

  onDeleteRequested(entry: JournalEntryWithPlant): void {
    this.confirmationService.confirm({
      message: `Delete this ${entry.category} entry for ${entry.plants.common_name}? This cannot be undone.`,
      header: 'Delete entry',
      acceptLabel: 'Delete entry',
      rejectLabel: 'Cancel',
      accept: () => void this.executeDelete(entry),
    });
  }

  private async executeDelete(entry: JournalEntryWithPlant): Promise<void> {
    try {
      await this.journalService.deleteEntry(entry.id);
      await this.journalService.loadEntries();
      this.messageService.add({
        severity: 'success',
        summary: 'Entry deleted',
        detail: 'The care event has been removed.',
      });
    } catch (e) {
      this.messageService.add({
        severity: 'error',
        summary: 'Failed to delete entry',
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

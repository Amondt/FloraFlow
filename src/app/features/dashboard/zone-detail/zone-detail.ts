import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import {
  FloraConfirmDialogPT,
  FloraSkeletonPT,
  FloraTagPT,
  FloraToastPT,
} from '../../../shared/ui/pt/index';
import { PendingDeleteManager } from '../../../shared/utils/pending-delete';
import { daysSince } from '../../../shared/utils/date.util';
import { ZoneService } from '../zone.service';
import { ZoneFormData } from '../zone.model';
import { ZoneFormComponent } from '../zone-form/zone-form';
import { PlantService } from '../../tasks/plant.service';
import { JournalService } from '../../journal/journal.service';
import { Plant, PlantFormData } from '../../tasks/plant.model';
import { PlantFormDialogComponent } from '../../tasks/plant-form-dialog/plant-form-dialog';
import { SoilCheckDialogComponent } from '../../tasks/soil-check-dialog/soil-check-dialog';
import { BotanicalDetailDialogComponent } from '../../../shared/components/botanical-detail-dialog/botanical-detail-dialog';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { LibraryService, CachedBotanicalRecord } from '../../library/library.service';
import { EnrichmentPoll } from '../../../shared/utils/enrichment-poll';
import { CareRecommendationsPanelComponent } from '../../../shared/components/care-recommendations-panel/care-recommendations-panel';
import { plantAddedDetail } from '../../../shared/utils/plant-message.util';
import { blurActiveElement } from '../../../shared/utils/dom';

type PlantCheckStatus = 'overdue' | 'due-today' | 'on-track';
type SortField = 'due-date' | 'name' | 'last-checked';
type SortDir = 'asc' | 'desc';

interface EnrichedPlant {
  plant: Plant;
  status: PlantCheckStatus;
  nextCheckLabel: string;
  lastCheckedLabel: string;
}

@Component({
  selector: 'app-zone-detail',
  standalone: true,
  imports: [
    RouterLink,
    ButtonModule,
    ConfirmDialog,
    SkeletonModule,
    ToastModule,
    ZoneFormComponent,
    PlantFormDialogComponent,
    SoilCheckDialogComponent,
    BotanicalDetailDialogComponent,
    LeafIconComponent,
    CareRecommendationsPanelComponent,
    TagModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './zone-detail.html',
})
export class ZoneDetailComponent {
  readonly id = input<string>('');

  protected readonly zoneService = inject(ZoneService);
  protected readonly plantService = inject(PlantService);
  private readonly libraryService = inject(LibraryService);
  private readonly journalService = inject(JournalService);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraTagPT = FloraTagPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3, 4];

  // ── Sort + search ─────────────────────────────────────────────
  readonly sortField = signal<SortField>('due-date');
  readonly sortDir = signal<SortDir>('asc');
  readonly searchQuery = signal('');

  protected readonly sortOptions: { field: SortField; label: string }[] = [
    { field: 'due-date', label: 'Due date' },
    { field: 'name', label: 'Name' },
    { field: 'last-checked', label: 'Last checked' },
  ];

  // ── Zone + plant data ─────────────────────────────────────────
  protected readonly zone = computed(() =>
    this.zoneService.zones().find((z) => z.id === this.id()),
  );

  private readonly _deleteManager = new PendingDeleteManager();

  private readonly _rawZonePlants = computed(() =>
    this.plantService.plants().filter((p) => p.zone_id === this.id()),
  );

  protected readonly totalZonePlants = computed(
    () => this._rawZonePlants().filter((p) => !this._deleteManager.pendingIds().has(p.id)).length,
  );

  protected readonly enrichedPlants = computed((): EnrichedPlant[] => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(
      startOfToday.getFullYear(),
      startOfToday.getMonth(),
      startOfToday.getDate() + 1,
    );
    const pendingIds = this._deleteManager.pendingIds();
    const query = this.searchQuery().toLowerCase().trim();
    const field = this.sortField();
    const dir = this.sortDir();

    let plants = this._rawZonePlants().filter((p) => {
      if (pendingIds.has(p.id)) return false;
      if (!query) return true;
      return (
        p.common_name.toLowerCase().includes(query) ||
        (p.scientific_name?.toLowerCase().includes(query) ?? false)
      );
    });

    plants = [...plants].sort((a, b) => {
      let cmp = 0;
      if (field === 'due-date') {
        cmp = new Date(a.next_check_due_at).getTime() - new Date(b.next_check_due_at).getTime();
      } else if (field === 'name') {
        cmp = a.common_name.localeCompare(b.common_name);
      } else {
        const aTs = a.last_checked_at ? new Date(a.last_checked_at).getTime() : 0;
        const bTs = b.last_checked_at ? new Date(b.last_checked_at).getTime() : 0;
        cmp = aTs - bTs;
      }
      return dir === 'asc' ? cmp : -cmp;
    });

    return plants.map((plant) => {
      const due = new Date(plant.next_check_due_at);
      const status: PlantCheckStatus =
        due < startOfToday ? 'overdue' : due < startOfTomorrow ? 'due-today' : 'on-track';
      const daysOverdue = Math.round((startOfToday.getTime() - due.getTime()) / 86_400_000);
      const nextCheckLabel =
        status === 'overdue'
          ? `Overdue · ${daysOverdue}d`
          : status === 'due-today'
            ? 'Due today'
            : due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      const ts = plant.last_checked_at;
      let lastCheckedLabel: string;
      if (!ts) {
        lastCheckedLabel = 'Never checked';
      } else {
        const days = daysSince(ts);
        if (days === 0) lastCheckedLabel = 'Checked today';
        else if (days === 1) lastCheckedLabel = 'Checked yesterday';
        else lastCheckedLabel = `Checked ${days}d ago`;
      }

      return { plant, status, nextCheckLabel, lastCheckedLabel };
    });
  });

  // ── Dialog state ──────────────────────────────────────────────
  readonly zoneFormVisible = signal(false);
  readonly activeSoilPlant = signal<Plant | null>(null);
  readonly activeSpeciesRecord = signal<CachedBotanicalRecord | null>(null);
  readonly speciesLoading = signal(false);
  readonly soilCheckVisible = signal(false);
  readonly plantFormVisible = signal(false);
  readonly editingPlant = signal<Plant | null>(null);

  // ── Care panel state ──────────────────────────────────────────
  readonly botanicalMap = signal<Map<string, CachedBotanicalRecord>>(new Map());
  readonly expandedPlantId = signal<string | null>(null);

  private readonly _poll = new EnrichmentPoll();
  readonly enrichingNames = this._poll.enrichingNames;
  readonly enrichingCount = this._poll.enrichingCount;

  readonly enrichedRecordFor = (scientificName: string): CachedBotanicalRecord | null => {
    const record = this.botanicalMap().get(scientificName);
    return record?.is_ai_enriched ? record : null;
  };

  // Plant–zone compatibility warnings. Each entry is keyed by plant.id.
  protected readonly incompatibilities = computed((): Map<string, string[]> => {
    const zone = this.zone();
    const map = new Map<string, string[]>();
    if (!zone) return map;

    // Orientations with little direct sunlight (Northern Hemisphere)
    const lowLightOrientations = new Set(['North', 'Northeast', 'Northwest']);
    // Orientations with intense direct sunlight
    const highLightOrientations = new Set(['South', 'Southeast', 'Southwest']);

    for (const ep of this.enrichedPlants()) {
      const { plant } = ep;
      if (!plant.scientific_name) continue;
      const botanical = this.enrichedRecordFor(plant.scientific_name);
      if (!botanical) continue;

      const warnings: string[] = [];

      // 1. Placement mismatch
      if (botanical.placement === 'Indoor' && zone.zone_type === 'outdoor') {
        warnings.push('Prefers indoor conditions');
      } else if (botanical.placement === 'Outdoor' && zone.zone_type === 'indoor') {
        warnings.push('Prefers outdoor conditions');
      }

      // 2. Zone humidity below the plant's documented ideal minimum
      if (
        botanical.ideal_humidity_min != null &&
        zone.humidity_baseline < botanical.ideal_humidity_min
      ) {
        warnings.push(
          `Zone humidity (${zone.humidity_baseline}%) below this plant's minimum (${botanical.ideal_humidity_min}%)`,
        );
      }

      // 3. Light / window orientation (indoor zones only — outdoor has ambient sun)
      if (zone.zone_type === 'indoor') {
        const sunlight = botanical.sunlight;
        if (sunlight && sunlight.length > 0) {
          const orientation = zone.window_orientation;
          const needsHighLight =
            sunlight.includes('full_sun') &&
            !sunlight.includes('full_shade') &&
            !sunlight.includes('filtered_indirect');
          const needsLowLight = !sunlight.includes('full_sun') && !sunlight.includes('part_shade');

          if (orientation === 'None' && !zone.has_grow_lights) {
            warnings.push('No natural light source — grow lights recommended');
          } else if (
            lowLightOrientations.has(orientation) &&
            needsHighLight &&
            !zone.has_grow_lights
          ) {
            warnings.push('Needs direct sunlight — north-facing zones provide little');
          } else if (highLightOrientations.has(orientation) && needsLowLight) {
            warnings.push('Prefers indirect light — direct sun may cause leaf scorch');
          }
        }
      }

      if (warnings.length > 0) {
        map.set(plant.id, warnings);
      }
    }

    return map;
  });

  constructor() {
    void this.zoneService.loadZones();
    void this.plantService.loadPlants();
    this.destroyRef.onDestroy(() => {
      this._deleteManager.flushAll((id) => this.plantService.deletePlant(id));
      this._poll.stop();
    });
    effect(() => {
      if (this._rawZonePlants().length > 0) {
        void this._loadBotanicalRecords();
      }
    });
  }

  toggleSortDir(): void {
    this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  // ── Zone actions ──────────────────────────────────────────────
  openEditZone(): void {
    if (!this.zone()) return;
    blurActiveElement();
    this.zoneFormVisible.set(true);
  }

  async onZoneSaved(formData: ZoneFormData): Promise<void> {
    const z = this.zone();
    if (!z) return;
    await this.zoneService.updateZone(z.id, formData);
    if (this.zoneService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Update failed',
        detail: this.zoneService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: 'Zone updated',
        detail: `"${formData.name}" has been saved.`,
      });
    }
  }

  // ── Soil check actions ────────────────────────────────────────
  openSoilCheck(plant: Plant): void {
    blurActiveElement();
    this.activeSoilPlant.set(plant);
    this.soilCheckVisible.set(true);
  }

  onSoilDialogVisibleChange(v: boolean): void {
    this.soilCheckVisible.set(v);
    if (!v) this.activeSoilPlant.set(null);
  }

  async onConfirmed(payload: { plant: Plant; note: string; days: number }): Promise<void> {
    await this.plantService.confirmCheck(payload.plant.id, payload.days);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Check failed',
        detail: this.plantService.error()!,
      });
      return;
    }
    try {
      await this.journalService.logWatering(payload.plant.id, payload.note);
    } catch {
      // journal write is non-critical — soil check already confirmed
    }
    this.messageService.add({
      severity: 'success',
      summary: 'Watering logged',
      detail: `Watering for "${payload.plant.common_name}" added to your journal.`,
    });
  }

  async onSnoozed(payload: { id: string; days: number }): Promise<void> {
    await this.plantService.snoozeCheck(payload.id, payload.days);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Snooze failed',
        detail: this.plantService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'info',
        summary: 'Check snoozed',
        detail: 'Next check rescheduled.',
      });
    }
  }

  // ── Species info actions ──────────────────────────────────────
  async openSpeciesInfo(plant: Plant): Promise<void> {
    if (!plant.scientific_name || this.speciesLoading()) return;
    this.speciesLoading.set(true);
    const record = await this.libraryService.fetchByScientificName(plant.scientific_name);
    this.speciesLoading.set(false);
    if (record) {
      this.activeSpeciesRecord.set(record);
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'No species data',
        detail: `No botanical record found for "${plant.scientific_name}".`,
      });
    }
  }

  onSpeciesDialogClose(visible: boolean): void {
    if (!visible) this.activeSpeciesRecord.set(null);
  }

  // ── Care panel actions ────────────────────────────────────────
  toggleCarePanel(id: string): void {
    this.expandedPlantId.update((current) => (current === id ? null : id));
  }

  private async _loadBotanicalRecords(): Promise<void> {
    const names = [
      ...new Set(
        this._rawZonePlants()
          .map((p) => p.scientific_name)
          .filter((n): n is string => n !== null),
      ),
    ];
    const toFetch = names.filter((n) => !untracked(() => this.botanicalMap()).has(n));
    if (toFetch.length === 0) return;
    const records = await this.libraryService.refetchByScientificNames(toFetch);
    this.botanicalMap.update((map) => {
      const updated = new Map(map);
      for (const record of records) {
        updated.set(record.scientific_name, record);
      }
      return updated;
    });
    const needsEnrichment = records.filter((r) => !r.is_ai_enriched || r.description == null);
    if (needsEnrichment.length > 0) {
      this._poll.start(
        needsEnrichment.map((r) => r.scientific_name),
        async (pending) => {
          const refreshed = await this.libraryService.refetchByScientificNames(pending);
          if (refreshed.length === 0) return new Set(pending);
          this.botanicalMap.update((map) => {
            const updated = new Map(map);
            for (const record of refreshed) {
              updated.set(record.scientific_name, record);
            }
            return updated;
          });
          return new Set(
            refreshed
              .filter((r) => !r.is_ai_enriched || r.description == null)
              .map((r) => r.scientific_name),
          );
        },
      );
      void this.libraryService.triggerEnrichment(needsEnrichment, this._poll.controller?.signal);
    }
  }

  // ── Plant actions ─────────────────────────────────────────────
  openAddPlant(): void {
    blurActiveElement();
    this.editingPlant.set(null);
    this.plantFormVisible.set(true);
  }

  openEditPlant(plant: Plant): void {
    blurActiveElement();
    this.editingPlant.set(plant);
    this.plantFormVisible.set(true);
  }

  async onPlantSaved(formData: PlantFormData): Promise<void> {
    const target = this.editingPlant();
    if (target) {
      await this.plantService.updatePlant(target.id, formData);
      if (this.plantService.error()) {
        this.messageService.add({
          severity: 'error',
          summary: 'Update failed',
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Plant updated',
          detail: `"${formData.common_name}" has been saved.`,
        });
      }
    } else {
      const newPlant = await this.plantService.createPlant(formData);
      if (this.plantService.error() || !newPlant) {
        this.messageService.add({
          severity: 'error',
          summary: 'Add plant failed',
          detail: this.plantService.error() ?? 'Something went wrong.',
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Plant added',
          detail: plantAddedDetail(formData.common_name, newPlant.next_check_due_at),
        });
      }
    }
  }

  onDeleteRequested(plant: Plant): void {
    this.confirmService.confirm({
      message: `Remove "${plant.common_name}"? You can undo this.`,
      header: 'Delete plant',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Plant deleted',
          detail: `"${plant.common_name}" removed. Tap Undo to cancel.`,
          life: 5000,
          data: { canUndo: true, id: plant.id },
        });
        this._deleteManager.schedule(plant.id, 5000, async () => {
          await this.plantService.deletePlant(plant.id);
          if (this.plantService.error()) {
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: this.plantService.error()!,
            });
          }
        });
      },
    });
  }

  undoDelete(id: string): void {
    this._deleteManager.undo(id);
    this.messageService.clear();
  }
}

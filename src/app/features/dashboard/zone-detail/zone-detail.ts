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
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { FloraConfirmDialogPT, FloraSkeletonPT, FloraToastPT } from '../../../shared/ui/pt/index';
import { BotanicalTagsComponent } from '../../../shared/components/botanical-tags/botanical-tags';
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
import { SubstrateMixWizardDialogComponent } from '../../../shared/components/substrate-mix-wizard/substrate-mix-wizard-dialog';
import { LeafDoctorDialogComponent } from '../../journal/leaf-doctor-dialog/leaf-doctor-dialog';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { PhotoLightboxDialogComponent } from '../../../shared/components/photo-lightbox-dialog/photo-lightbox-dialog';
import { LibraryService, CachedBotanicalRecord } from '../../library/library.service';
import { EnrichmentPoll } from '../../../shared/utils/enrichment-poll';
import { buildGalleryPhotos } from '../../../shared/utils/botanical-photo.util';
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
    SubstrateMixWizardDialogComponent,
    LeafDoctorDialogComponent,
    LeafIconComponent,
    PhotoLightboxDialogComponent,
    CareRecommendationsPanelComponent,
    BotanicalTagsComponent,
    TranslocoPipe,
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
  private readonly t = inject(TranslocoService);
  private readonly _activeLang = toSignal(this.t.langChanges$, {
    initialValue: this.t.getActiveLang(),
  });

  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly loadingPlaceholders = [1, 2, 3, 4];

  // ── Sort + search ─────────────────────────────────────────────
  readonly sortField = signal<SortField>('due-date');
  readonly sortDir = signal<SortDir>('asc');
  readonly searchQuery = signal('');

  protected readonly sortOptions: { field: SortField; labelKey: string }[] = [
    { field: 'due-date', labelKey: 'zones.sort.dueDate' },
    { field: 'name', labelKey: 'zones.sort.name' },
    { field: 'last-checked', labelKey: 'zones.sort.lastChecked' },
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
    this._activeLang();
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
          ? this.t.translate('zones.detail.overdue', { days: daysOverdue })
          : status === 'due-today'
            ? this.t.translate('zones.detail.dueToday')
            : due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

      const ts = plant.last_checked_at;
      let lastCheckedLabel: string;
      if (!ts) {
        lastCheckedLabel = this.t.translate('zones.detail.neverChecked');
      } else {
        const days = daysSince(ts);
        if (days === 0) lastCheckedLabel = this.t.translate('zones.detail.checkedToday');
        else if (days === 1) lastCheckedLabel = this.t.translate('zones.detail.checkedYesterday');
        else lastCheckedLabel = this.t.translate('zones.detail.checkedDaysAgo', { days });
      }

      return { plant, status, nextCheckLabel, lastCheckedLabel };
    });
  });

  // ── Photo lightbox state ──────────────────────────────────────
  readonly lightboxVisible = signal(false);
  readonly lightboxPhotos = signal<string[]>([]);
  readonly lightboxAlt = signal<string>('');

  protected galleryPhotosFor(scientificName: string): string[] {
    return buildGalleryPhotos(this.botanicalMap().get(scientificName));
  }

  protected openImageLightbox(event: Event, scientificName: string, altText: string): void {
    event.stopPropagation();
    this.lightboxPhotos.set(this.galleryPhotosFor(scientificName));
    this.lightboxAlt.set(altText);
    this.lightboxVisible.set(true);
  }

  // ── Dialog state ──────────────────────────────────────────────
  readonly zoneFormVisible = signal(false);
  readonly activeSoilPlant = signal<Plant | null>(null);
  readonly activeSpeciesRecord = signal<CachedBotanicalRecord | null>(null);
  readonly speciesLoading = signal(false);
  readonly soilCheckVisible = signal(false);
  readonly plantFormVisible = signal(false);
  readonly editingPlant = signal<Plant | null>(null);

  // ── Leaf Doctor state ─────────────────────────────────────────
  readonly diagnosisPlant = signal<Plant | null>(null);
  readonly diagnosisVisible = signal(false);

  // ── Mix wizard state ──────────────────────────────────────────
  readonly wizardVisible = signal(false);
  readonly wizardPlant = signal<Plant | null>(null);
  readonly wizardRecord = signal<CachedBotanicalRecord | null>(null);
  private _savedSpeciesRecord: CachedBotanicalRecord | null = null;

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
    this._activeLang();
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
        warnings.push(this.t.translate('zones.incompatibility.prefersIndoor'));
      } else if (botanical.placement === 'Outdoor' && zone.zone_type === 'indoor') {
        warnings.push(this.t.translate('zones.incompatibility.prefersOutdoor'));
      }

      // 2. Zone humidity below the plant's documented ideal minimum
      if (
        botanical.ideal_humidity_min != null &&
        zone.humidity_baseline < botanical.ideal_humidity_min
      ) {
        warnings.push(
          this.t.translate('zones.incompatibility.humidityLow', {
            zoneHumidity: zone.humidity_baseline,
            minHumidity: botanical.ideal_humidity_min,
          }),
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
            warnings.push(this.t.translate('zones.incompatibility.noLight'));
          } else if (
            lowLightOrientations.has(orientation) &&
            needsHighLight &&
            !zone.has_grow_lights
          ) {
            warnings.push(this.t.translate('zones.incompatibility.needsDirectLight'));
          } else if (highLightOrientations.has(orientation) && needsLowLight) {
            warnings.push(this.t.translate('zones.incompatibility.tooMuchLight'));
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
        summary: this.t.translate('zones.toast.updateFailed'),
        detail: this.zoneService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('zones.toast.zoneUpdated'),
        detail: this.t.translate('zones.toast.zoneUpdatedDetail', { name: formData.name }),
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
        summary: this.t.translate('zones.toast.checkFailed'),
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
      summary: this.t.translate('zones.toast.wateringLogged'),
      detail: this.t.translate('zones.toast.wateringLoggedDetail', {
        name: payload.plant.common_name,
      }),
    });
  }

  async onSnoozed(payload: { id: string; days: number }): Promise<void> {
    await this.plantService.snoozeCheck(payload.id, payload.days);
    if (this.plantService.error()) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('zones.toast.snoozeFailed'),
        detail: this.plantService.error()!,
      });
    } else {
      this.messageService.add({
        severity: 'info',
        summary: this.t.translate('zones.toast.checkSnoozed'),
        detail: this.t.translate('zones.toast.checkSnoozedDetail'),
      });
    }
  }

  // ── Leaf Doctor actions ───────────────────────────────────────
  openDiagnosis(plant: Plant): void {
    blurActiveElement();
    this.diagnosisPlant.set(plant);
    this.diagnosisVisible.set(true);
  }

  onDiagnosisClose(v: boolean): void {
    this.diagnosisVisible.set(v);
    if (!v) this.diagnosisPlant.set(null);
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
        summary: this.t.translate('zones.toast.noSpeciesData'),
        detail: this.t.translate('zones.toast.noSpeciesDataDetail', {
          species: plant.scientific_name,
        }),
      });
    }
  }

  onSpeciesDialogClose(visible: boolean): void {
    if (!visible) this.activeSpeciesRecord.set(null);
  }

  // ── Mix wizard actions ────────────────────────────────────────
  openMixWizard(plant: Plant): void {
    blurActiveElement();
    this._savedSpeciesRecord = null;
    this.wizardPlant.set(plant);
    const record = plant.scientific_name
      ? (this.botanicalMap().get(plant.scientific_name) ?? null)
      : null;
    this.wizardRecord.set(record);
    this.wizardVisible.set(true);
  }

  openWizardFromBotanical(record: CachedBotanicalRecord): void {
    this._savedSpeciesRecord = this.activeSpeciesRecord();
    this.activeSpeciesRecord.set(null);
    this.wizardPlant.set(null);
    this.wizardRecord.set(record);
    this.wizardVisible.set(true);
  }

  onWizardClose(isVisible: boolean): void {
    if (!isVisible) {
      this.wizardVisible.set(false);
      const saved = this._savedSpeciesRecord;
      this._savedSpeciesRecord = null;
      this.wizardRecord.set(null);
      this.wizardPlant.set(null);
      if (saved) this.activeSpeciesRecord.set(saved);
    }
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
          summary: this.t.translate('zones.toast.plantUpdateFailed'),
          detail: this.plantService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: this.t.translate('zones.toast.plantUpdated'),
          detail: this.t.translate('zones.toast.plantUpdatedDetail', {
            name: formData.common_name,
          }),
        });
      }
    } else {
      const newPlant = await this.plantService.createPlant(formData);
      if (this.plantService.error() || !newPlant) {
        this.messageService.add({
          severity: 'error',
          summary: this.t.translate('zones.toast.plantAddFailed'),
          detail: this.plantService.error() ?? 'Something went wrong.',
        });
      } else {
        const { key: dKey, params: dParams } = plantAddedDetail(
          formData.common_name,
          newPlant.next_check_due_at,
        );
        this.messageService.add({
          severity: 'success',
          summary: this.t.translate('zones.toast.plantAdded'),
          detail: this.t.translate(dKey, dParams),
        });
      }
    }
  }

  onDeleteRequested(plant: Plant): void {
    this.confirmService.confirm({
      message: this.t.translate('zones.toast.plantDeleteMessage', { name: plant.common_name }),
      header: this.t.translate('zones.toast.plantDeleteHeader'),
      acceptLabel: this.t.translate('common.delete'),
      rejectLabel: this.t.translate('common.cancel'),
      accept: () => {
        this.messageService.add({
          severity: 'warn',
          summary: this.t.translate('zones.toast.plantDeleted'),
          detail: this.t.translate('zones.toast.plantDeletedDetail', { name: plant.common_name }),
          life: 5000,
          data: { canUndo: true, id: plant.id },
        });
        this._deleteManager.schedule(plant.id, 5000, async () => {
          await this.plantService.deletePlant(plant.id);
          if (this.plantService.error()) {
            this.messageService.add({
              severity: 'error',
              summary: this.t.translate('zones.toast.plantDeleteFailed'),
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

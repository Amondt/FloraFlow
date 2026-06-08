import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import {
  FloraButtonPT,
  FloraMessagePT,
  FloraSkeletonPT,
  FloraConfirmDialogPT,
  FloraToastPT,
} from '../../shared/ui/pt/index';
import { PlantService } from '../tasks/plant.service';
import { Plant, PlantFormData } from '../tasks/plant.model';
import { PlantFormDialogComponent } from '../tasks/plant-form-dialog/plant-form-dialog';
import { ZoneService } from './zone.service';
import { ZoneCardComponent } from './zone-card/zone-card';
import { LeafIconComponent } from '../../shared/components/leaf-icon/leaf-icon';
import { blurActiveElement } from '../../shared/utils/dom';
import { PendingDeleteManager } from '../../shared/utils/pending-delete';
import { plantAddedDetail } from '../../shared/utils/plant-message.util';
import { ZoneFormComponent } from './zone-form/zone-form';
import { Zone, ZoneFormData } from './zone.model';
import { ProfileService } from '../../core/services/profile.service';
import { WeatherService } from '../../core/services/weather.service';
import { LocationDialogComponent } from './location-dialog/location-dialog';
import { BotanicalThumbnailService } from '../../core/services/botanical-thumbnail.service';
import {
  PlantIdentifierDialogComponent,
  type PlantIdentifiedEvent,
} from '../../shared/components/plant-identifier/plant-identifier-dialog';
import { BotanicalDetailDialogComponent } from '../../shared/components/botanical-detail-dialog/botanical-detail-dialog';
import { SubstrateMixWizardDialogComponent } from '../../shared/components/substrate-mix-wizard/substrate-mix-wizard-dialog';
import { LibraryService, type CachedBotanicalRecord } from '../library/library.service';

interface AttentionChip {
  plant: Plant;
  label: string;
  isOverdue: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    ButtonModule,
    MessageModule,
    SkeletonModule,
    ConfirmDialog,
    ToastModule,
    ZoneCardComponent,
    ZoneFormComponent,
    PlantFormDialogComponent,
    LeafIconComponent,
    LocationDialogComponent,
    PlantIdentifierDialogComponent,
    BotanicalDetailDialogComponent,
    SubstrateMixWizardDialogComponent,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  protected readonly zoneService = inject(ZoneService);
  protected readonly plantService = inject(PlantService);
  protected readonly profileService = inject(ProfileService);
  protected readonly weatherService = inject(WeatherService);
  protected readonly thumbnailService = inject(BotanicalThumbnailService);
  private readonly libraryService = inject(LibraryService);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraMessagePT = FloraMessagePT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraToastPT = FloraToastPT;

  // ── Greeting ──────────────────────────────────────────────────
  protected readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
  );

  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  });

  // ── Global stats ──────────────────────────────────────────────
  protected readonly totalPlantCount = computed(() => this.plantService.plants().length);
  protected readonly totalZoneCount = computed(() => this.zoneService.zones().length);

  // ── Zone name lookup for chip rows ────────────────────────────
  protected readonly zoneMap = computed(
    () => new Map(this.zoneService.zones().map((z) => [z.id, z])),
  );

  // ── Attention chips: overdue + due today + due in ≤1 day ─────
  protected readonly attentionChips = computed((): AttentionChip[] => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const endOfTomorrow = new Date(startOfTomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    return this.plantService
      .plants()
      .filter((p) => new Date(p.next_check_due_at) < endOfTomorrow)
      .sort(
        (a, b) => new Date(a.next_check_due_at).getTime() - new Date(b.next_check_due_at).getTime(),
      )
      .slice(0, 6)
      .map((p) => {
        const due = new Date(p.next_check_due_at);
        const isOverdue = due < startOfToday;
        const label = isOverdue
          ? `overdue ${Math.ceil((startOfToday.getTime() - due.getTime()) / 86_400_000)}d`
          : due < startOfTomorrow
            ? 'due today'
            : 'due in 1d';
        return { plant: p, label, isOverdue };
      });
  });

  protected readonly attentionOverdueCount = computed(
    () => this.attentionChips().filter((c) => c.isOverdue).length,
  );

  // ── Frost alert ───────────────────────────────────────────────
  protected readonly hasLocation = computed(() => this.profileService.profile()?.latitude != null);

  protected readonly outdoorZones = computed(() =>
    this.zoneService.zones().filter((z) => z.zone_type === 'outdoor'),
  );

  protected readonly outdoorZoneNames = computed(() =>
    this.outdoorZones()
      .map((z) => z.name)
      .join(', '),
  );

  readonly locationDialogVisible = signal(false);

  // ── Plant Identifier + Botanical Detail ───────────────────────
  readonly identifierDialogOpen = signal(false);
  readonly botanicalDetailVisible = signal(false);
  readonly botanicalDetailRecords = signal<CachedBotanicalRecord[]>([]);
  readonly botanicalPrefill = signal<{
    common_name: string;
    scientific_name: string | null;
    inat_taxon_id: number | null;
  } | null>(null);
  readonly wizardVisible = signal(false);
  readonly wizardFromBotanicalRecord = signal<CachedBotanicalRecord | null>(null);
  private _savedBotanicalRecords: CachedBotanicalRecord[] = [];

  // ── Zone stats for zone-card inputs ──────────────────────────
  readonly zoneStats = computed(() => {
    const plants = this.plantService.plants();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    return new Map(
      this.zoneService.zones().map((z) => {
        const zonePlants = plants.filter((p) => p.zone_id === z.id);
        const overdueCount = zonePlants.filter(
          (p) => new Date(p.next_check_due_at) < startOfToday,
        ).length;
        const dueTodayCount = zonePlants.filter((p) => {
          const d = new Date(p.next_check_due_at);
          return d >= startOfToday && d < startOfTomorrow;
        }).length;
        const names = zonePlants.map((p) => p.common_name);
        return [z.id, { count: zonePlants.length, overdueCount, dueTodayCount, names }];
      }),
    );
  });

  // ── Zone dialog ───────────────────────────────────────────────
  readonly zoneDialogVisible = signal(false);
  readonly editingZone = signal<Zone | null>(null);
  private readonly _deleteManager = new PendingDeleteManager();
  readonly displayedZones = computed(() =>
    this.zoneService.zones().filter((z) => !this._deleteManager.pendingIds().has(z.id)),
  );

  // ── Plant Add dialog (Dashboard entry point) ──────────────────
  readonly plantFormVisible = signal(false);

  constructor() {
    void this.zoneService.loadZones();
    void this.plantService.loadPlants();
    this.destroyRef.onDestroy(() => {
      this._deleteManager.cancelAll();
    });

    effect(() => {
      const plants = this.plantService.plants();
      if (plants.length > 0) void this.thumbnailService.loadFor(plants);
    });

    // Load weather whenever the profile gains a location
    effect(() => {
      const profile = this.profileService.profile();
      const lat = profile?.latitude;
      const lon = profile?.longitude;
      if (lat != null && lon != null) {
        void untracked(() => this.weatherService.loadWeather(lat, lon));
      }
    });
  }

  // ── Chip class helpers (return full class strings for Tailwind scanning) ──
  protected chipThumbClass(isOverdue: boolean): string {
    const base = 'flex-shrink-0 w-12 h-12 rounded-garden-sm flex items-center justify-center';
    return isOverdue
      ? `${base} bg-yellow-50 dark:bg-yellow-900/20`
      : `${base} bg-primary-50 dark:bg-primary-900/20`;
  }

  protected chipIconColorClass(isOverdue: boolean): string {
    return isOverdue ? 'text-warning-500' : 'text-primary-500';
  }

  protected chipStatusClass(isOverdue: boolean): string {
    return isOverdue ? 'text-warning-500' : 'text-neutral-500 dark:text-neutral-400';
  }

  protected chipAriaLabel(chip: AttentionChip): string {
    const zone = this.zoneMap().get(chip.plant.zone_id)?.name ?? 'unknown zone';
    return `${chip.plant.common_name} in ${zone} — ${chip.label}`;
  }

  // ── Plant Add dialog (Dashboard entry point) ─────────────────
  openAddPlantDialog(): void {
    blurActiveElement();
    this.plantFormVisible.set(true);
  }

  // ── Plant Identifier ──────────────────────────────────────────
  openIdentifierDialog(): void {
    blurActiveElement();
    this.identifierDialogOpen.set(true);
  }

  async onPlantIdentified(event: PlantIdentifiedEvent): Promise<void> {
    const record = await this.libraryService.fetchByScientificName(event.scientific_name);
    if (record) {
      this.botanicalDetailRecords.set([record]);
      this.botanicalDetailVisible.set(true);
    } else {
      this.messageService.add({
        severity: 'info',
        summary: 'Species identified',
        detail: 'Care data is loading. Check the Library in a moment.',
      });
    }
  }

  onAddToMyPlants(event: PlantIdentifiedEvent): void {
    this.botanicalPrefill.set({
      common_name: event.common_name,
      scientific_name: event.scientific_name,
      inat_taxon_id: event.inat_taxon_id,
    });
    this.plantFormVisible.set(true);
  }

  protected onBotanicalAddRequested(record: CachedBotanicalRecord): void {
    this.botanicalPrefill.set({
      common_name: record.common_name,
      scientific_name: record.scientific_name,
      inat_taxon_id: record.inat_taxon_id,
    });
    this.botanicalDetailVisible.set(false);
    this.plantFormVisible.set(true);
  }

  protected onBotanicalSeedsRequested(record: CachedBotanicalRecord): void {
    this.botanicalDetailVisible.set(false);
    void this.router.navigate(['/seeds'], {
      queryParams: {
        name: record.common_name,
        scientific: record.scientific_name ?? null,
      },
    });
  }

  protected openWizardFromBotanical(record: CachedBotanicalRecord): void {
    this._savedBotanicalRecords = this.botanicalDetailRecords();
    this.botanicalDetailVisible.set(false);
    this.wizardFromBotanicalRecord.set(record);
    this.wizardVisible.set(true);
  }

  protected onBotanicalWizardClose(isVisible: boolean): void {
    if (!isVisible) {
      const savedRecords = this._savedBotanicalRecords;
      this._savedBotanicalRecords = [];
      this.wizardFromBotanicalRecord.set(null);
      this.wizardVisible.set(false);
      if (savedRecords.length > 0) {
        this.botanicalDetailRecords.set(savedRecords);
        this.botanicalDetailVisible.set(true);
      }
    }
  }

  // ── Location dialog ───────────────────────────────────────────
  openLocationDialog(): void {
    blurActiveElement();
    this.locationDialogVisible.set(true);
  }

  async onLocationSaved(coords: { lat: number; lon: number; locationName: string }): Promise<void> {
    try {
      await this.profileService.setLocation(coords.lat, coords.lon, coords.locationName);
      this.messageService.add({
        severity: 'success',
        summary: 'Location saved',
        detail: 'Location saved — frost alerts are now active',
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Location error',
        detail: 'Failed to save location — try again',
      });
    }
  }

  async onLocationCleared(): Promise<void> {
    await this.profileService.clearLocation();
    this.weatherService.weather.set(null);
    this.messageService.add({
      severity: 'info',
      summary: 'Location cleared',
      detail: 'Location cleared — frost alerts disabled',
    });
  }

  // ── Zone actions ──────────────────────────────────────────────
  openCreateZoneDialog(): void {
    this.editingZone.set(null);
    this.zoneDialogVisible.set(true);
  }

  openEditDialog(zone: Zone): void {
    this.editingZone.set(zone);
    this.zoneDialogVisible.set(true);
  }

  async onZoneSaved(formData: ZoneFormData): Promise<void> {
    const target = this.editingZone();
    if (target) {
      await this.zoneService.updateZone(target.id, formData);
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
    } else {
      await this.zoneService.createZone(formData);
      if (this.zoneService.error()) {
        this.messageService.add({
          severity: 'error',
          summary: 'Add failed',
          detail: this.zoneService.error()!,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Zone added',
          detail: `"${formData.name}" added to your greenhouse.`,
        });
      }
    }
  }

  onDeleteRequest(zoneId: string): void {
    const zone = this.zoneService.zones().find((z) => z.id === zoneId);
    if (!zone) return;
    this.confirmationService.confirm({
      message: `Remove "${zone.name}"? All its plants will also be removed. You can undo this.`,
      header: 'Delete Zone',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.messageService.add({
          severity: 'warn',
          summary: 'Zone deleted',
          detail: `"${zone.name}" and all its plants removed. Tap Undo to cancel.`,
          life: 5000,
          data: { canUndo: true, id: zoneId },
        });
        this._deleteManager.schedule(zoneId, 5000, async () => {
          await this.zoneService.deleteZone(zoneId);
          if (this.zoneService.error()) {
            this.messageService.add({
              severity: 'error',
              summary: 'Delete failed',
              detail: this.zoneService.error()!,
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

  // ── Plant actions ─────────────────────────────────────────────
  async onPlantSaved(formData: PlantFormData): Promise<void> {
    const newPlant = await this.plantService.createPlant(formData);
    if (this.plantService.error() || !newPlant) {
      this.messageService.add({
        severity: 'error',
        summary: 'Add plant failed',
        detail: this.plantService.error()!,
      });
    } else {
      this.botanicalPrefill.set(null);
      this.messageService.add({
        severity: 'success',
        summary: 'Plant added',
        detail: plantAddedDetail(formData.common_name, newPlant.next_check_due_at),
      });
    }
  }
}

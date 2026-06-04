import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
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
import { PlantService } from '../scheduler/plant.service';
import { Plant, PlantFormData } from '../scheduler/plant.model';
import { PlantFormDialogComponent } from '../scheduler/plant-form-dialog/plant-form-dialog';
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
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  protected readonly zoneService = inject(ZoneService);
  protected readonly plantService = inject(PlantService);
  protected readonly profileService = inject(ProfileService);
  protected readonly weatherService = inject(WeatherService);
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

  readonly locationDialogVisible = signal(false);

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
    const base = 'flex-shrink-0 w-10 h-10 rounded-garden-sm flex items-center justify-center';
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
      this.messageService.add({
        severity: 'success',
        summary: 'Plant added',
        detail: plantAddedDetail(formData.common_name, newPlant.next_check_due_at),
      });
    }
  }
}

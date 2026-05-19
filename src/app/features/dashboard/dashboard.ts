import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
import { ZoneService } from './zone.service';
import { ZoneCardComponent } from './zone-card/zone-card';
import { ZoneFormComponent } from './zone-form/zone-form';
import { Zone, ZoneFormData } from './zone.model';

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
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  protected readonly zoneService          = inject(ZoneService);
  protected readonly plantService         = inject(PlantService);
  private  readonly confirmationService   = inject(ConfirmationService);
  private  readonly messageService        = inject(MessageService);
  private  readonly destroyRef            = inject(DestroyRef);

  protected readonly FloraButtonPT        = FloraButtonPT;
  protected readonly FloraMessagePT       = FloraMessagePT;
  protected readonly FloraSkeletonPT      = FloraSkeletonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;
  protected readonly FloraToastPT         = FloraToastPT;

  protected readonly overdueCount = computed(() => {
    const now = new Date();
    return this.plantService.plants().filter(p => new Date(p.next_check_due_at) <= now).length;
  });

  readonly zoneStats = computed(() => {
    const plants = this.plantService.plants();
    const now    = new Date();
    return new Map(
      this.zoneService.zones().map(z => {
        const zonePlants   = plants.filter(p => p.zone_id === z.id);
        const overdueCount = zonePlants.filter(p => new Date(p.next_check_due_at) < now).length;
        const names        = zonePlants.map(p => p.common_name);
        return [z.id, { count: zonePlants.length, overdueCount, names }];
      })
    );
  });

  readonly dialogVisible       = signal(false);
  readonly editingZone         = signal<Zone | null>(null);
  readonly pendingDeleteZoneIds = signal<Set<string>>(new Set());
  readonly displayedZones       = computed(() =>
    this.zoneService.zones().filter(z => !this.pendingDeleteZoneIds().has(z.id))
  );
  private readonly _deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    void this.zoneService.loadZones();
    void this.plantService.loadPlants();
    this.destroyRef.onDestroy(() => {
      this._deleteTimers.forEach(clearTimeout);
      this._deleteTimers.clear();
    });
  }

  openCreateDialog(): void {
    this.editingZone.set(null);
    this.dialogVisible.set(true);
  }

  openEditDialog(zone: Zone): void {
    this.editingZone.set(zone);
    this.dialogVisible.set(true);
  }

  async onSaved(formData: ZoneFormData): Promise<void> {
    const target = this.editingZone();
    if (target) {
      await this.zoneService.updateZone(target.id, formData);
      if (this.zoneService.error()) {
        this.messageService.add({ severity: 'error', summary: 'Update failed', detail: this.zoneService.error()! });
      } else {
        this.messageService.add({ severity: 'success', summary: 'Zone updated', detail: `"${formData.name}" has been saved.` });
      }
    } else {
      await this.zoneService.createZone(formData);
      if (this.zoneService.error()) {
        this.messageService.add({ severity: 'error', summary: 'Add failed', detail: this.zoneService.error()! });
      } else {
        this.messageService.add({ severity: 'success', summary: 'Zone added', detail: `"${formData.name}" added to your greenhouse.` });
      }
    }
  }

  onDeleteRequest(zoneId: string): void {
    const zone = this.zoneService.zones().find(z => z.id === zoneId);
    if (!zone) return;
    this.confirmationService.confirm({
      message: `Remove "${zone.name}"? All its plants will also be removed. You can undo this.`,
      header: 'Delete Zone',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => {
        this.pendingDeleteZoneIds.update(ids => new Set([...ids, zoneId]));
        this.messageService.add({
          severity: 'warn',
          summary: 'Zone deleted',
          detail: `"${zone.name}" and all its plants removed. Tap Undo to cancel.`,
          life: 5000,
          data: { canUndo: true, id: zoneId },
        });
        const timer = setTimeout(async () => {
          this._deleteTimers.delete(zoneId);
          this.pendingDeleteZoneIds.update(ids => {
            const next = new Set(ids);
            next.delete(zoneId);
            return next;
          });
          await this.zoneService.deleteZone(zoneId);
          if (this.zoneService.error()) {
            this.messageService.add({ severity: 'error', summary: 'Delete failed', detail: this.zoneService.error()! });
          }
        }, 5000);
        this._deleteTimers.set(zoneId, timer);
      },
    });
  }

  undoDelete(id: string): void {
    const timer = this._deleteTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._deleteTimers.delete(id);
    }
    this.pendingDeleteZoneIds.update(ids => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
    this.messageService.clear();
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import {
  FloraButtonPT,
  FloraMessagePT,
  FloraSkeletonPT,
  FloraConfirmDialogPT,
} from '../../shared/ui/pt/index';
import { PlantService } from '../scheduler/plant.service';
import { ZoneService } from './zone.service';
import { ZoneCardComponent } from './zone-card';
import { ZoneFormComponent } from './zone-form';
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
    ZoneCardComponent,
    ZoneFormComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  protected readonly zoneService          = inject(ZoneService);
  protected readonly plantService         = inject(PlantService);
  private  readonly confirmationService   = inject(ConfirmationService);

  protected readonly FloraButtonPT        = FloraButtonPT;
  protected readonly FloraMessagePT       = FloraMessagePT;
  protected readonly FloraSkeletonPT      = FloraSkeletonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;

  protected readonly overdueCount = computed(() => this.plantService.duePlants().length);

  readonly dialogVisible = signal(false);
  readonly editingZone   = signal<Zone | null>(null);

  constructor() {
    void this.zoneService.loadZones();
    void this.plantService.loadDuePlants();
  }

  openCreateDialog(): void {
    this.editingZone.set(null);
    this.dialogVisible.set(true);
  }

  openEditDialog(zone: Zone): void {
    this.editingZone.set(zone);
    this.dialogVisible.set(true);
  }

  onSaved(formData: ZoneFormData): void {
    const target = this.editingZone();
    if (target) {
      void this.zoneService.updateZone(target.id, formData);
    } else {
      void this.zoneService.createZone(formData);
    }
  }

  onDeleteRequest(zoneId: string): void {
    const zone = this.zoneService.zones().find(z => z.id === zoneId);
    if (!zone) return;
    this.confirmationService.confirm({
      message: `Delete "${zone.name}"? All plants in this zone will also be removed.`,
      header: 'Delete Zone',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      accept: () => void this.zoneService.deleteZone(zoneId),
    });
  }
}

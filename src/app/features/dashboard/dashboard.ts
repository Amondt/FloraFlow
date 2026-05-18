import { Component, afterNextRender, inject, signal } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import {
  FloraButtonPT,
  FloraSkeletonPT,
  FloraConfirmDialogPT,
} from '../../shared/ui/pt/index';
import { ZoneService } from './zone.service';
import { ZoneCardComponent } from './zone-card';
import { ZoneFormComponent } from './zone-form';
import { Zone, ZoneFormData } from './zone.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    ButtonModule,
    SkeletonModule,
    ConfirmDialog,
    ZoneCardComponent,
    ZoneFormComponent,
  ],
  providers: [ConfirmationService],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  protected readonly zoneService         = inject(ZoneService);
  private  readonly confirmationService  = inject(ConfirmationService);

  protected readonly FloraButtonPT        = FloraButtonPT;
  protected readonly FloraSkeletonPT      = FloraSkeletonPT;
  protected readonly FloraConfirmDialogPT = FloraConfirmDialogPT;

  readonly dialogVisible = signal(false);
  readonly editingZone   = signal<Zone | null>(null);

  constructor() {
    afterNextRender(() => {
      void this.zoneService.loadZones();
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

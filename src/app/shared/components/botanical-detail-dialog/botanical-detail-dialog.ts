import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CachedBotanicalRecord } from '../../../features/library/library.service';
import { getSunlightLabels, getWateringLabel } from '../../utils/botanical-label.util';
import { FloraButtonPT, FloraDetailDialogPT } from '../../ui/pt/index';

@Component({
  selector: 'app-botanical-detail-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule],
  templateUrl: './botanical-detail-dialog.html',
})
export class BotanicalDetailDialogComponent {
  readonly record = input<CachedBotanicalRecord | null>(null);
  readonly visible = input<boolean>(false);
  readonly showAddButton = input<boolean>(true);
  readonly visibleChange = output<boolean>();
  readonly addRequested = output<CachedBotanicalRecord>();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraDetailDialogPT = FloraDetailDialogPT;

  protected readonly sunlightLabels = computed(() => getSunlightLabels(this.record()?.sunlight));

  protected readonly wateringLabel = computed(() => getWateringLabel(this.record()?.watering));

  protected onAdd(): void {
    const rec = this.record();
    if (rec) this.addRequested.emit(rec);
  }
}

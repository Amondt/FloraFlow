import { Component, computed, input, model, output } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FloraDialogPT, FloraButtonPT } from '../../shared/ui/pt/index';
import { Plant } from './plant.model';

@Component({
  selector: 'app-soil-check-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  templateUrl: './soil-check-dialog.html',
})
export class SoilCheckDialogComponent {
  readonly plant     = input.required<Plant>();
  readonly visible   = model<boolean>(false);
  readonly confirmed = output<Plant>();
  readonly snoozed   = output<string>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;

  readonly dialogHeader = computed(() => `Soil Check — ${this.plant().common_name}`);

  onConfirm(): void {
    this.confirmed.emit(this.plant());
    this.visible.set(false);
  }

  onSnooze(): void {
    this.snoozed.emit(this.plant().id);
    this.visible.set(false);
  }
}

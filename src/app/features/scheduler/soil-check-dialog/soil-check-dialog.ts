import { Component, computed, input, model, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FloraDialogPT, FloraButtonPT } from '../../../shared/ui/pt/index';
import { Plant } from '../plant.model';

type CheckStep = 'ask' | 'dry' | 'moist';

@Component({
  selector: 'app-soil-check-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule],
  templateUrl: './soil-check-dialog.html',
})
export class SoilCheckDialogComponent {
  readonly plant     = input.required<Plant>();
  readonly zoneName  = input<string | null>(null);
  readonly visible   = model<boolean>(false);
  readonly confirmed = output<Plant>();
  readonly snoozed   = output<string>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;

  readonly step          = signal<CheckStep>('ask');
  readonly snoozeDays    = signal(5);
  readonly note          = signal('');
  readonly snoozePresets = [2, 5, 7] as const;

  readonly checkDepth = computed(() =>
    this.plant().substrate_factor === 'Desert Succulent' ? '8 cm' : '5 cm'
  );

  readonly lastCheckedLabel = computed(() => {
    const ts = this.plant().last_checked_at;
    if (!ts) return 'never checked';
    const days = Math.round((Date.now() - new Date(ts).getTime()) / 86_400_000);
    if (days === 0) return 'last checked today';
    if (days === 1) return 'last checked yesterday';
    return `last checked ${days} days ago`;
  });

  readonly recommendedDays = computed(() => {
    const interval = this.plant().current_snooze_interval_days;
    if (!interval) return 5;
    const presets = [2, 5, 7] as const;
    return presets.reduce((prev, cur) =>
      Math.abs(cur - interval) < Math.abs(prev - interval) ? cur : prev
    );
  });

  readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  );

  readonly snoozeLabelText = computed(() => `Snooze ${this.snoozeDays()} days`);

  onVisibleChange(v: boolean): void {
    if (!v) {
      this.step.set('ask');
      this.note.set('');
    }
    this.visible.set(v);
  }

  onDry(): void {
    this.step.set('dry');
  }

  onMoist(): void {
    this.snoozeDays.set(this.recommendedDays());
    this.step.set('moist');
  }

  onBack(): void {
    this.step.set('ask');
  }

  onConfirm(): void {
    this.confirmed.emit(this.plant());
    this.close();
  }

  onSnooze(): void {
    this.snoozed.emit(this.plant().id);
    this.close();
  }

  onCancel(): void {
    this.close();
  }

  private close(): void {
    this.step.set('ask');
    this.note.set('');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.visible.set(false);
  }
}

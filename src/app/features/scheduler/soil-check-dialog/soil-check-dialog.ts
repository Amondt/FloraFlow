import { Component, computed, input, model, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FloraDialogPT, FloraButtonPT } from '../../../shared/ui/pt/index';
import { Plant, SubstrateFactor } from '../plant.model';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { blurActiveElement } from '../../../shared/utils/dom';

const SUBSTRATE_DEPTH_RULES: Record<SubstrateFactor, { depth: string; description: string }> = {
  'High-Drainage Aroid': {
    depth: '3 cm',
    description: 'This mix drains quickly — water when the top 3 cm are dry.',
  },
  'Standard Potting': { depth: '3 cm', description: 'Water when the top 3 cm of soil are dry.' },
  'Heavy Peat': {
    depth: '3 cm',
    description: 'Peat retains moisture well — water when the top 3 cm are dry.',
  },
  'Sphagnum Moss Mix': {
    depth: '2 cm',
    description: 'Sphagnum likes to stay mostly moist — check shallower than usual.',
  },
  'Desert Succulent': {
    depth: '5 cm',
    description: 'Succulents need soil to fully dry out between waterings.',
  },
};

type CheckStep = 'ask' | 'dry' | 'moist';

@Component({
  selector: 'app-soil-check-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, LeafIconComponent],
  templateUrl: './soil-check-dialog.html',
})
export class SoilCheckDialogComponent {
  readonly plant = input.required<Plant>();
  readonly zoneName = input<string | null>(null);
  readonly visible = model<boolean>(false);
  readonly confirmed = output<{ plant: Plant; note: string }>();
  readonly snoozed = output<{ id: string; days: number }>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;

  readonly step = signal<CheckStep>('ask');
  readonly snoozeDays = signal(5);
  readonly note = signal('');
  readonly snoozePresets = [2, 5, 7] as const;

  readonly checkDepth = computed(() => SUBSTRATE_DEPTH_RULES[this.plant().substrate_factor].depth);

  readonly checkDepthDescription = computed(
    () => SUBSTRATE_DEPTH_RULES[this.plant().substrate_factor].description,
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
      Math.abs(cur - interval) < Math.abs(prev - interval) ? cur : prev,
    );
  });

  readonly todayLabel = computed(() =>
    new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
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
    this.confirmed.emit({ plant: this.plant(), note: this.note() });
    this.close();
  }

  onSnooze(): void {
    this.snoozed.emit({ id: this.plant().id, days: this.snoozeDays() });
    this.close();
  }

  onCancel(): void {
    this.close();
  }

  private close(): void {
    this.step.set('ask');
    this.note.set('');
    blurActiveElement();
    this.visible.set(false);
  }
}

import { Component, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Select, SelectModule } from 'primeng/select';
import { FloraSelectGhostPT, FloraSelectPT } from '../../ui/pt/index';
import { LeafIconComponent } from '../leaf-icon/leaf-icon';

export interface PlantOption {
  label: string;
  value: string | null;
  scientificName?: string | null;
  thumbnailUrl?: string | null;
  count?: number;
}

export interface PlantOptionGroup {
  label: string;
  items: PlantOption[];
}

@Component({
  selector: 'app-plant-select',
  standalone: true,
  imports: [FormsModule, SelectModule, LeafIconComponent, TranslocoPipe],
  templateUrl: './plant-select.html',
})
export class PlantSelectComponent {
  protected readonly FloraSelectPT = FloraSelectPT;
  protected readonly FloraSelectGhostPT = FloraSelectGhostPT;

  readonly options = input.required<PlantOption[] | PlantOptionGroup[]>();
  readonly grouped = input<boolean>(false);
  readonly value = model<string | null>(null);
  readonly placeholder = input<string>('');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly ariaLabelledBy = input<string | undefined>(undefined);
  readonly required = input<boolean>(false);
  readonly inputId = input<string | undefined>(undefined);
  readonly ghost = input<boolean>(false);

  private readonly _select = viewChild<Select>('innerSelectRef');

  hide(): void {
    this._select()?.hide();
  }

  /**
   * On the mobile bottom-sheet variant (`ghost`), PrimeNG auto-scrolls the previously
   * selected option into view, which can leave the sheet opened mid-list with a sliver
   * of the prior group's last row peeking above the new sticky group header. A filter
   * sheet should always open at the top of the first group, so force scrollTop back to 0.
   * `flora-select-sheet-list` is a marker class set on the ghost PT's listContainer slot
   * (select.pt.ts) — not a Tailwind utility — purely so we can query it here.
   */
  protected onPanelShow(): void {
    if (!this.ghost()) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.flora-select-sheet-list')?.scrollTo({ top: 0 });
    });
  }
}

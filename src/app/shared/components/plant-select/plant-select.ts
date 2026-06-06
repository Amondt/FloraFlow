import { Component, input, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Select, SelectModule } from 'primeng/select';
import { FloraSelectPT } from '../../ui/pt/index';
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
  imports: [FormsModule, SelectModule, LeafIconComponent],
  templateUrl: './plant-select.html',
})
export class PlantSelectComponent {
  protected readonly FloraSelectPT = FloraSelectPT;

  readonly options = input.required<PlantOption[] | PlantOptionGroup[]>();
  readonly grouped = input<boolean>(false);
  readonly value = model<string | null>(null);
  readonly placeholder = input<string>('');
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly ariaLabelledBy = input<string | undefined>(undefined);
  readonly required = input<boolean>(false);
  readonly inputId = input<string | undefined>(undefined);

  private readonly _select = viewChild<Select>('innerSelectRef');

  hide(): void {
    this._select()?.hide();
  }
}

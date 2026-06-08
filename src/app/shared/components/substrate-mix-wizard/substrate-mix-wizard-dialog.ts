import { Component, computed, input, linkedSignal, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { Popover, PopoverModule } from 'primeng/popover';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import {
  FloraDetailDialogPT,
  FloraInputNumberPT,
  FloraButtonPT,
  FloraPopoverPT,
  FLORA_FOCUS,
  FLORA_HOVER,
} from '../../ui/pt/index';
import type { Plant, SubstrateFactor } from '../../../features/tasks/plant.model';
import type { CachedBotanicalRecord } from '../../../features/library/library.service';
import {
  GENUS_PROFILES,
  POT_SIZE_CHIPS,
  computeMix,
  diameterToVolume,
  getPhStatus,
  preferredSoilToProfile,
  substrateFactorToProfile,
} from '../../utils/substrate-mix.model';
import type {
  GenusProfileName,
  SubstrateMixResult,
  PhStatus,
  PotSizeChip,
} from '../../utils/substrate-mix.model';

@Component({
  selector: 'app-substrate-mix-wizard-dialog',
  standalone: true,
  imports: [DialogModule, PopoverModule, InputNumberModule, ButtonModule, FormsModule],
  templateUrl: './substrate-mix-wizard-dialog.html',
})
export class SubstrateMixWizardDialogComponent {
  readonly visible = model<boolean>(false);
  readonly plant = input<Plant | null>(null);
  readonly botanicalRecord = input<CachedBotanicalRecord | null>(null);
  readonly substratePreset = input<SubstrateFactor | null>(null);
  readonly backLabel = input<string | null>(null);

  protected readonly FloraDetailDialogPT = FloraDetailDialogPT;
  protected readonly FloraInputNumberPT = FloraInputNumberPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraPopoverPT = FloraPopoverPT;

  protected readonly GENUS_PROFILES = GENUS_PROFILES;
  protected readonly POT_SIZE_CHIPS = POT_SIZE_CHIPS;

  protected readonly volumeInputId = `flora-wizard-vol-${crypto.randomUUID().slice(0, 8)}`;

  private readonly _infoPopover = viewChild<Popover>('infoPopover');

  // Active selection: starts at the recommended value and resets each time the dialog opens
  protected readonly selectedProfile = linkedSignal<GenusProfileName>(() => {
    this.visible(); // reset selection on every dialog open
    const p = this.plant();
    if (p?.substrate_factor) return substrateFactorToProfile(p.substrate_factor);
    const record = this.botanicalRecord();
    if (record?.preferred_soil_type?.length) {
      const mapped = preferredSoilToProfile(record.preferred_soil_type);
      if (mapped) return mapped;
    }
    const preset = this.substratePreset();
    if (preset) return substrateFactorToProfile(preset);
    return 'General Tropical';
  });

  // Volume resets on dialog open as well for consistency
  protected readonly rawVolume = linkedSignal<number>(() => {
    this.visible();
    const pd = this.plant()?.pot_diameter_cm;
    if (pd != null) return diameterToVolume(pd);
    return 1;
  });

  // Chip highlight resets on dialog open
  protected readonly selectedChipDiameter = linkedSignal<number | null>(() => {
    this.visible();
    const pd = this.plant()?.pot_diameter_cm;
    return pd != null ? this._nearestChipDiameter(pd) : null;
  });

  // Stable derivation: the data-backed recommendation — never changes from user interaction
  protected readonly recommendedProfile = computed<GenusProfileName | null>(() => {
    const p = this.plant();
    if (p?.substrate_factor) return substrateFactorToProfile(p.substrate_factor);
    const record = this.botanicalRecord();
    if (record?.preferred_soil_type?.length) {
      const mapped = preferredSoilToProfile(record.preferred_soil_type);
      if (mapped) return mapped;
    }
    const preset = this.substratePreset();
    if (preset) return substrateFactorToProfile(preset);
    return null;
  });

  // Note label — always visible when there is a data-backed recommendation, regardless of selection
  protected readonly recommendationSourceLabel = computed<string | null>(() => {
    const p = this.plant();
    if (p?.substrate_factor) return "Recommended from this plant's substrate profile";
    const record = this.botanicalRecord();
    if (record?.preferred_soil_type?.length) {
      const mapped = preferredSoilToProfile(record.preferred_soil_type);
      if (mapped) return 'Recommended from species soil data';
    }
    const preset = this.substratePreset();
    if (preset) return 'Recommended from a substrate preset';
    return null;
  });

  protected readonly mixResult = computed<SubstrateMixResult>(() =>
    computeMix(this.selectedProfile(), Math.max(0.01, this.rawVolume())),
  );

  protected readonly phStatus = computed<PhStatus | null>(() => {
    const record = this.botanicalRecord();
    if (!record?.ideal_min_ph || !record?.ideal_max_ph) return null;
    const result = this.mixResult();
    return getPhStatus(result.phLow, result.phHigh, record.ideal_min_ph, record.ideal_max_ph);
  });

  protected readonly showSpeciesNudge = computed<boolean>(() => {
    const p = this.plant();
    return p != null && p.scientific_name == null && this.phStatus() == null;
  });

  protected profileCardClass(name: GenusProfileName): string {
    const base = `relative cursor-pointer w-full h-full flex flex-col text-left rounded-garden-sm p-3 ${FLORA_FOCUS} ${FLORA_HOVER}`;
    return this.selectedProfile() === name
      ? `${base} border-2 border-primary-600 bg-primary-50 dark:bg-primary-900/20`
      : `${base} border border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600`;
  }

  protected chipClass(diameterCm: number): string {
    const base = `cursor-pointer relative px-3 py-1.5 rounded-full text-xs font-medium font-display ${FLORA_FOCUS} ${FLORA_HOVER}`;
    return this.selectedChipDiameter() === diameterCm
      ? `${base} bg-primary-600 text-white ring-2 ring-primary-600`
      : `${base} bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600`;
  }

  protected selectProfile(name: GenusProfileName): void {
    this.selectedProfile.set(name);
  }

  protected selectChip(chip: PotSizeChip): void {
    this.selectedChipDiameter.set(chip.diameterCm);
    this.rawVolume.set(chip.volumeLitres);
  }

  protected onVolumeInput(value: number | null): void {
    if (value == null || value <= 0) return;
    this.rawVolume.set(value);
    this.selectedChipDiameter.set(null);
  }

  protected toggleInfoPopover(event: Event): void {
    this._infoPopover()?.toggle(event);
  }

  protected close(): void {
    this.visible.set(false);
  }

  private _nearestChipDiameter(pd: number): number | null {
    let nearest: PotSizeChip | null = null;
    let minDist = Infinity;
    for (const chip of POT_SIZE_CHIPS) {
      const dist = Math.abs(pd - chip.diameterCm);
      if (dist < minDist) {
        minDist = dist;
        nearest = chip;
      }
    }
    return nearest?.diameterCm ?? null;
  }
}

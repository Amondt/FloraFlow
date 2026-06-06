import type { SubstrateFactor } from '../../features/tasks/plant.model';

// ─── Internal component data ──────────────────────────────────────────────────

interface SubstrateComponent {
  readonly name: string;
  readonly pHLow: number;
  readonly pHHigh: number;
}

const ORCHID_BARK: SubstrateComponent = { name: 'Orchid Bark', pHLow: 4.0, pHHigh: 6.5 };
const PERLITE: SubstrateComponent = { name: 'Perlite', pHLow: 7.0, pHHigh: 7.0 };
const COCO_COIR: SubstrateComponent = { name: 'Coco Coir', pHLow: 6.0, pHHigh: 6.8 };
const COARSE_SAND: SubstrateComponent = { name: 'Coarse Sand', pHLow: 7.0, pHHigh: 7.0 };
const STANDARD_POTTING: SubstrateComponent = {
  name: 'Standard Potting Mix',
  pHLow: 6.0,
  pHHigh: 7.0,
};
const SPHAGNUM_MOSS: SubstrateComponent = { name: 'Sphagnum Moss', pHLow: 3.5, pHHigh: 4.5 };
const PEAT_MOSS: SubstrateComponent = { name: 'Peat Moss', pHLow: 3.0, pHHigh: 4.5 };

// ─── Genus profiles ───────────────────────────────────────────────────────────

export type GenusProfileName =
  | 'Epiphytic Aroid'
  | 'Desert Succulent'
  | 'Sphagnum Epiphyte'
  | 'Peat-Based Bog'
  | 'General Tropical';

interface ProfileComponent {
  readonly component: SubstrateComponent;
  readonly fraction: number;
}

export interface GenusProfile {
  readonly name: GenusProfileName;
  readonly components: readonly ProfileComponent[];
  readonly typicalUse: string;
}

export const GENUS_PROFILES: readonly GenusProfile[] = [
  {
    name: 'Epiphytic Aroid',
    typicalUse: 'Monsteras, Philodendrons, Pothos',
    components: [
      { component: ORCHID_BARK, fraction: 0.4 },
      { component: PERLITE, fraction: 0.3 },
      { component: COCO_COIR, fraction: 0.3 },
    ],
  },
  {
    name: 'Desert Succulent',
    typicalUse: 'Cacti, Echeveria, Aloe',
    components: [
      { component: STANDARD_POTTING, fraction: 0.4 },
      { component: COARSE_SAND, fraction: 0.35 },
      { component: PERLITE, fraction: 0.25 },
    ],
  },
  {
    name: 'Sphagnum Epiphyte',
    typicalUse: 'Orchids, moisture-loving epiphytes',
    components: [
      { component: SPHAGNUM_MOSS, fraction: 0.6 },
      { component: PERLITE, fraction: 0.3 },
      { component: ORCHID_BARK, fraction: 0.1 },
    ],
  },
  {
    name: 'Peat-Based Bog',
    typicalUse: 'Carnivorous plants, acid-loving tropicals',
    components: [
      { component: PEAT_MOSS, fraction: 0.5 },
      { component: PERLITE, fraction: 0.3 },
      { component: COARSE_SAND, fraction: 0.2 },
    ],
  },
  {
    name: 'General Tropical',
    typicalUse: 'Most common houseplants',
    components: [
      { component: STANDARD_POTTING, fraction: 0.5 },
      { component: PERLITE, fraction: 0.25 },
      { component: COCO_COIR, fraction: 0.25 },
    ],
  },
];

// ─── Mix result ───────────────────────────────────────────────────────────────

export interface MixComponent {
  readonly name: string;
  readonly fraction: number;
  readonly volumeLitres: number;
}

export interface SubstrateMixResult {
  readonly profileName: GenusProfileName;
  readonly components: readonly MixComponent[];
  readonly phLow: number;
  readonly phHigh: number;
}

// ─── pH status ────────────────────────────────────────────────────────────────

export type PhCompatibility = 'compatible' | 'too-acidic' | 'too-alkaline';

export interface PhStatus {
  readonly compatibility: PhCompatibility;
  readonly message: string;
  readonly idealMin: number;
  readonly idealMax: number;
}

// ─── Pot size lookup table & UI chips ────────────────────────────────────────

const POT_DIAMETER_TABLE: readonly { diameterCm: number; volumeLitres: number }[] = [
  { diameterCm: 6, volumeLitres: 0.07 },
  { diameterCm: 8, volumeLitres: 0.15 },
  { diameterCm: 9, volumeLitres: 0.25 },
  { diameterCm: 10, volumeLitres: 0.4 },
  { diameterCm: 12, volumeLitres: 0.7 },
  { diameterCm: 14, volumeLitres: 1.0 },
  { diameterCm: 15, volumeLitres: 1.3 },
  { diameterCm: 17, volumeLitres: 2.0 },
  { diameterCm: 19, volumeLitres: 3.0 },
  { diameterCm: 20, volumeLitres: 3.2 },
  { diameterCm: 21, volumeLitres: 4.0 },
  { diameterCm: 25, volumeLitres: 6.0 },
  { diameterCm: 30, volumeLitres: 10.0 },
];

export interface PotSizeChip {
  readonly label: string;
  readonly diameterCm: number;
  readonly volumeLitres: number;
}

export const POT_SIZE_CHIPS: readonly PotSizeChip[] = [
  { label: '10 cm', diameterCm: 10, volumeLitres: 0.4 },
  { label: '12 cm', diameterCm: 12, volumeLitres: 0.7 },
  { label: '15 cm', diameterCm: 15, volumeLitres: 1.3 },
  { label: '20 cm', diameterCm: 20, volumeLitres: 3.2 },
  { label: '25 cm', diameterCm: 25, volumeLitres: 6.0 },
];

// ─── Exported functions ───────────────────────────────────────────────────────

/** Snaps a pot diameter in cm to the nearest entry in the standard lookup table. */
export function diameterToVolume(cm: number): number {
  let nearest = POT_DIAMETER_TABLE[0];
  let minDistance = Math.abs(cm - nearest.diameterCm);

  for (const entry of POT_DIAMETER_TABLE) {
    const distance = Math.abs(cm - entry.diameterCm);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = entry;
    }
  }

  return nearest.volumeLitres;
}

/**
 * Computes a substrate mix recipe using the H⁺ ion weighted mean method.
 * pH is logarithmic — averaging pH numbers directly overstates acidity by up to 1.7 units
 * for peat-heavy mixes. This converts to [H+] concentration first, weights, then converts back.
 */
export function computeMix(
  profileName: GenusProfileName,
  volumeLitres: number,
): SubstrateMixResult {
  const profile = GENUS_PROFILES.find((p) => p.name === profileName)!;

  let hPlusMostAcidic = 0;
  let hPlusMostAlkaline = 0;

  for (const { component, fraction } of profile.components) {
    hPlusMostAcidic += Math.pow(10, -component.pHLow) * fraction;
    hPlusMostAlkaline += Math.pow(10, -component.pHHigh) * fraction;
  }

  const phLow = parseFloat((-Math.log10(hPlusMostAcidic)).toFixed(1));
  const phHigh = parseFloat((-Math.log10(hPlusMostAlkaline)).toFixed(1));

  const components: MixComponent[] = profile.components.map(({ component, fraction }) => ({
    name: component.name,
    fraction,
    volumeLitres: parseFloat((fraction * volumeLitres).toFixed(2)),
  }));

  return { profileName, components, phLow, phHigh };
}

/** Returns pH compatibility between a computed mix range and a plant's ideal pH range. */
export function getPhStatus(
  mixPhLow: number,
  mixPhHigh: number,
  idealMin: number,
  idealMax: number,
): PhStatus {
  const range = `pH ${idealMin.toFixed(1)}–${idealMax.toFixed(1)}`;

  if (mixPhHigh < idealMin) {
    return {
      compatibility: 'too-acidic',
      message: `Too acidic — plant needs ${range}`,
      idealMin,
      idealMax,
    };
  }

  if (mixPhLow > idealMax) {
    return {
      compatibility: 'too-alkaline',
      message: `Too alkaline — plant needs ${range}`,
      idealMin,
      idealMax,
    };
  }

  return {
    compatibility: 'compatible',
    message: `pH compatible (plant prefers ${range})`,
    idealMin,
    idealMax,
  };
}

/**
 * Maps a botanical record's preferred_soil_type array to the closest genus profile.
 * Returns null when no match is found — caller falls back to 'General Tropical'.
 */
export function preferredSoilToProfile(types: string[]): GenusProfileName | null {
  const hasSandy = types.includes('Sandy');
  const hasWellDraining = types.includes('Well-draining');
  const hasDryOrGritty = types.some((t) => t === 'Dry' || t === 'Gritty');

  if (hasSandy || (hasWellDraining && hasDryOrGritty)) return 'Desert Succulent';
  if (types.includes('Sphagnum')) return 'Sphagnum Epiphyte';
  if (types.some((t) => t === 'Peaty' || t === 'Acidic')) return 'Peat-Based Bog';
  if (types.some((t) => t === 'Chunky' || t === 'Bark')) return 'Epiphytic Aroid';

  return null;
}

/** Maps a plant's substrate_factor enum value to the matching genus profile name. */
export function substrateFactorToProfile(factor: SubstrateFactor): GenusProfileName {
  const profileMap: Record<SubstrateFactor, GenusProfileName> = {
    'High-Drainage Aroid': 'Epiphytic Aroid',
    'Desert Succulent': 'Desert Succulent',
    'Sphagnum Moss Mix': 'Sphagnum Epiphyte',
    'Heavy Peat': 'Peat-Based Bog',
    'Standard Potting': 'General Tropical',
  };

  return profileMap[factor];
}

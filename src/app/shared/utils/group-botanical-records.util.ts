import type { CachedBotanicalRecord } from '../../features/library/library.service';

export interface SpeciesGroup {
  commonName: string;
  baseScientificName: string;
  representative: CachedBotanicalRecord;
  varieties: CachedBotanicalRecord[];
}

function hasNoCultivar(record: CachedBotanicalRecord): boolean {
  return !record.scientific_name.includes("'");
}

function extractBaseScientificName(scientificName: string): string {
  const cultivarStart = scientificName.indexOf("'");
  return cultivarStart === -1
    ? scientificName.trim()
    : scientificName.slice(0, cultivarStart).trim();
}

function enrichmentScore(record: CachedBotanicalRecord): number {
  return (record.description != null ? 1 : 0) + (record.thumbnail_url != null ? 1 : 0);
}

function selectRepresentative(records: CachedBotanicalRecord[]): CachedBotanicalRecord {
  const baseSpecies = records.filter(hasNoCultivar);
  const candidates = baseSpecies.length > 0 ? baseSpecies : records;
  return [...candidates].sort((a, b) => {
    const scoreDiff = enrichmentScore(b) - enrichmentScore(a);
    return scoreDiff !== 0 ? scoreDiff : a.scientific_name.localeCompare(b.scientific_name);
  })[0];
}

function sortVarieties(records: CachedBotanicalRecord[]): CachedBotanicalRecord[] {
  return [...records].sort((a, b) => {
    const aIsBase = hasNoCultivar(a);
    const bIsBase = hasNoCultivar(b);
    if (aIsBase && !bIsBase) return -1;
    if (!aIsBase && bIsBase) return 1;
    return a.scientific_name.localeCompare(b.scientific_name);
  });
}

export function groupBotanicalRecords(records: CachedBotanicalRecord[]): SpeciesGroup[] {
  const groupMap = new Map<string, CachedBotanicalRecord[]>();

  for (const record of records) {
    const key = record.common_name.toLowerCase().trim();
    const existing = groupMap.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groupMap.set(key, [record]);
    }
  }

  const groups: SpeciesGroup[] = [];
  for (const groupRecords of groupMap.values()) {
    const representative = selectRepresentative(groupRecords);
    groups.push({
      commonName: representative.common_name,
      baseScientificName: extractBaseScientificName(representative.scientific_name),
      representative,
      varieties: sortVarieties(groupRecords),
    });
  }

  return groups.sort((a, b) => a.commonName.localeCompare(b.commonName));
}

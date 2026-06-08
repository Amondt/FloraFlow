// Minimal iNaturalist taxon shape needed to compute the species-rank ancestor.
// rank_level and parent_id arrive inline in every /v1/taxa response — no extra call needed.
export type InatTaxonRef = {
  id: number;
  rank_level: number;
  parent_id?: number;
};

// Computes inat_species_id following the two-tier identity rule:
//   rank_level === 10 (species / hybrid)       → self id
//   rank_level  <  10 (subspecies/variety/form) → parent_id (the species ancestor)
//   rank_level  >  10 (genus or coarser)        → null (not a species; grouping falls back)
export function deriveSpeciesId(taxon: InatTaxonRef): number | null {
  if (taxon.rank_level === 10) return taxon.id;
  if (taxon.rank_level < 10) return taxon.parent_id ?? null;
  return null;
}

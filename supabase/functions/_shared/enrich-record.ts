import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.ts';
import { toSentenceCase } from './text.ts';
import { deriveSpeciesId } from './inat.ts';

// ─── Row type alias ──────────────────────────────────────────────────────────

export type CachedBotanicalRow = Database['public']['Tables']['cached_botanical_records']['Row'];

// ─── Error class ─────────────────────────────────────────────────────────────

// Thrown by enrichRecord() when enrichment fails. The status field lets callers
// choose the correct HTTP response code: 503 for upstream AI/iNat failures,
// 500 for unexpected DB or runtime errors.
export class EnrichmentError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = 'EnrichmentError';
  }
}

// ─── System prompt ───────────────────────────────────────────────────────────

export const ENRICHMENT_SYSTEM_PROMPT = `You are the FloraFlow AI Scribe, an elite botanical taxonomist and agricultural data scientist. Your absolute directive is to provide highly precise, empirically grounded plant care metrics. You never hallucinate, invent unverified horticultural parameters, or generate prose.

When provided with a target species common name and scientific name, you must extract specific care parameters based exclusively on known botanical benchmarks for that genus and species. If a specific metric is completely undocumented or highly speculative, you must return a null field value — never substitute a plausible-sounding number.

CRITICAL ACCURACY RULES:
1. check_depth_description must reflect the species' actual watering requirements — not a generic formula. Aroids typically: "Allow top 2–3 cm to dry". Succulents typically: "Let soil dry completely between waterings". Ferns: "Keep consistently moist, check at the surface." Use null if the species is unknown to you.
2. ideal_humidity_min and ideal_humidity_max must be species-specific, not category averages. A Pothos and a Calathea are both tropicals but have different humidity tolerances. Use null if the species-specific range is undocumented.
3. Never invent numbers. A null is always more accurate than a fabricated value.
4. watering must be exactly one of: 'Frequent', 'Average', 'Minimum', 'None'. Return null if the species' watering needs are ambiguous or unknown.
5. sunlight must be an array using only these exact values: 'full_sun', 'part_shade', 'full_shade', 'filtered_indirect'. Return null if the species' light requirements are unknown.
6. cycle must be exactly one of: 'Perennial', 'Annual', 'Biennial', 'Biannual'. Return null if the species lifecycle is unclear.
7. propagation_methods must only contain values from this exact list: 'Stem Cuttings', 'Leaf Cuttings', 'Division', 'Seeds', 'Air Layering', 'Offset Separation'. Return an empty array [] if none apply or if the species' methods are unknown. Never invent a variant.
8. description: 1–2 sentences describing the plant's character and key traits in plain English. Include its visual signature and notable use. Example: "A fast-growing tropical aroid with large fenestrated leaves, prized for dramatic foliage and air-purifying qualities." Return null only for highly obscure species.
9. placement must be exactly one of: 'Indoor', 'Outdoor', 'Both'. 'Indoor' for tender plants unable to survive outdoors in temperate climates. 'Outdoor' for plants requiring direct sun, rain, or frost hardiness. 'Both' for adaptable species. Return null if genuinely unclear.
10. is_tropical: true for species native to tropical or subtropical regions (typically requiring RH > 50%, minimum temperature > 10°C). false for temperate species. Default to false if uncertain — never null.
11. is_toxic_to_humans: true if any part of the plant is known to cause harm when ingested or on skin contact. false if known safe or no data. Default to false if uncertain — never null.
12. human_toxicity_notes: populated only when is_toxic_to_humans is true. Brief clinical note, e.g. "Berries cause severe gastric upset if ingested. Sap may irritate skin and eyes." Return an empty string when is_toxic_to_humans is false.
13. produces_fruit: true if the species produces fruit (including berries, drupes, pods, hips) in typical cultivation. Default to false if uncertain — never null.
14. fruit_season: populated only when produces_fruit is true. Use natural language season ranges, e.g. "Late Summer", "Autumn – Winter", "Spring – Summer". Return an empty string when produces_fruit is false.
15. produces_flowers: true if the species produces flowers in typical cultivation. Default to false if uncertain — never null.
16. flowering_season: populated only when produces_flowers is true. Same format as fruit_season. Return an empty string when produces_flowers is false.
17. growth_rate must be exactly one of: 'Slow', 'Moderate', 'Fast'. Based on typical cultivation rate. Return null if genuinely variable or unknown.
18. maintenance_level must be exactly one of: 'Low', 'Medium', 'High'. 'Low' = tolerates neglect, infrequent watering. 'Medium' = regular watering and occasional attention. 'High' = frequent watering, misting, or precision care required. Return null if unclear.
19. preferred_soil_type: array of applicable descriptors from this exact list only: 'Well-draining', 'Sandy', 'Loamy', 'Clay', 'Peaty', 'Chalky', 'Rich', 'Poor', 'Moisture-retaining'. Return [] if unknown. Never invent descriptors outside this list.
20. native_region: plain-text geographic origin, e.g. "Tropical West Africa", "Mediterranean Basin", "Central and South America". Return null if origin is unclear or highly hybridised.
21. max_height_cm: mature height in centimetres in typical indoor or garden cultivation — not extreme wild specimens. Integer only. Return null if highly variable or unknown.
22. max_spread_cm: mature lateral spread in centimetres. Integer only. Return null if highly variable or unknown.
23. air_purifying: true if the plant is documented to filter indoor VOCs (formaldehyde, benzene, trichloroethylene) per NASA Clean Air Study or peer-reviewed equivalent. false otherwise — never null.`;

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const EnrichmentSchema = z.object({
  scientific_name: z.string(),
  common_name: z.string(),
  ideal_min_ph: z.number(),
  ideal_max_ph: z.number(),
  is_toxic_to_pets: z.boolean(),
  toxicity_notes: z.string().nullable(),
  propagation_methods: z
    .array(
      z.enum([
        'Stem Cuttings',
        'Leaf Cuttings',
        'Division',
        'Seeds',
        'Air Layering',
        'Offset Separation',
      ]),
    )
    .catch([]),
  check_depth_description: z.string().nullable(),
  ideal_humidity_min: z.number().nullable(),
  ideal_humidity_max: z.number().nullable(),
  care_difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).nullable(),
  watering: z.enum(['Frequent', 'Average', 'Minimum', 'None']).nullable(),
  sunlight: z
    .array(z.enum(['full_sun', 'part_shade', 'full_shade', 'filtered_indirect']))
    .nullable(),
  cycle: z.enum(['Perennial', 'Annual', 'Biennial', 'Biannual']).nullable(),
  description: z.string().nullable(),
  placement: z.enum(['Indoor', 'Outdoor', 'Both']).nullable(),
  is_tropical: z.boolean().catch(false),
  is_toxic_to_humans: z.boolean().catch(false),
  human_toxicity_notes: z.string().catch(''),
  produces_fruit: z.boolean().catch(false),
  fruit_season: z.string().catch(''),
  produces_flowers: z.boolean().catch(false),
  flowering_season: z.string().catch(''),
  growth_rate: z.enum(['Slow', 'Moderate', 'Fast']).nullable(),
  maintenance_level: z.enum(['Low', 'Medium', 'High']).nullable(),
  preferred_soil_type: z
    .array(
      z.enum([
        'Well-draining',
        'Sandy',
        'Loamy',
        'Clay',
        'Peaty',
        'Chalky',
        'Rich',
        'Poor',
        'Moisture-retaining',
      ]),
    )
    .catch([]),
  native_region: z.string().nullable(),
  max_height_cm: z.int().nullable().catch(null),
  max_spread_cm: z.int().nullable().catch(null),
  air_purifying: z.boolean().catch(false),
  is_ai_enriched: z.literal(true),
});

// ─── iNaturalist result type ──────────────────────────────────────────────────

type InatLookupResult = {
  taxon_id: number;
  species_id: number | null;
  rank: string | null;
  thumbnail_url: string | null;
  regular_url: string | null;
};

// ─── iNaturalist helpers ──────────────────────────────────────────────────────

// Fetches the best iNat match for a query. No rank=species filter so hybrids are found.
// taxon_id=47126 restricts to Plantae; is_active=true excludes deprecated/merged taxa.
// Returns null when iNat has no matching taxon (not just missing photo).
export async function queryINat(
  query: string,
  signal: AbortSignal,
): Promise<InatLookupResult | null> {
  try {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(query)}&taxon_id=47126&is_active=true&per_page=1&locale=en`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        id?: number;
        rank?: string;
        rank_level?: number;
        parent_id?: number;
        default_photo?: { url?: string; medium_url?: string };
      }>;
    };
    const first = data?.results?.[0];
    if (!first?.id) return null;
    const photo = first.default_photo;
    const speciesId = deriveSpeciesId({
      id: first.id,
      rank_level: first.rank_level ?? 10,
      parent_id: first.parent_id,
    });
    return {
      taxon_id: first.id,
      species_id: speciesId,
      rank: first.rank ?? null,
      thumbnail_url: photo?.url ?? null,
      regular_url: photo?.medium_url ?? null,
    };
  } catch {
    return null;
  }
}

export async function fetchINatGallery(
  inatTaxonId: number,
  signal: AbortSignal,
): Promise<string[]> {
  try {
    const res = await fetch(`https://api.inaturalist.org/v1/taxa/${inatTaxonId}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: Array<{
        taxon_photos?: Array<{
          photo?: { medium_url?: string; url?: string };
        }>;
      }>;
    };
    const photos = data?.results?.[0]?.taxon_photos ?? [];
    return photos
      .map((tp) => tp.photo?.medium_url ?? tp.photo?.url ?? '')
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function fetchINatThumbnail(
  scientificName: string,
  commonName: string,
): Promise<InatLookupResult & { taxon_id: number | null }> {
  // Cultivar suffixes (e.g. "'Variegata'") are not indexed by iNaturalist — strip them.
  const queryName = scientificName.split("'")[0].trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    // Scientific name first; fall back to common name when iNat has no entry for the species.
    const result =
      (await queryINat(queryName, controller.signal)) ??
      (await queryINat(commonName, controller.signal));
    return (
      result ?? {
        taxon_id: null,
        species_id: null,
        rank: null,
        thumbnail_url: null,
        regular_url: null,
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Core enrichment function ─────────────────────────────────────────────────

// Enriches one cached_botanical_records row: Claude AI + iNaturalist thumbnail.
// Idempotent — skips whichever steps are already complete for the given species.
// Throws EnrichmentError (status 503) on upstream AI/iNat failure, or a plain
// Error (status 500) on DB errors. Callers decide the HTTP response.
export async function enrichRecord(
  supabase: SupabaseClient<Database>,
  anthropic: Anthropic,
  scientificName: string,
  commonName: string,
): Promise<CachedBotanicalRow> {
  const { data: cached } = await supabase
    .from('cached_botanical_records')
    .select('*')
    .eq('scientific_name', scientificName)
    .maybeSingle();

  // Whether gallery is considered complete: already fetched (any value), no iNat ID yet,
  // or confirmed absent from iNat (sentinel -1). Null gallery with a valid taxon ID means
  // the fetch is still pending.
  const galleryDone =
    cached?.gallery_urls != null || !cached?.inat_taxon_id || cached.inat_taxon_id < 0;

  // Fully enriched — thumbnail either present or already confirmed absent, gallery done. Nothing to do.
  if (
    cached?.is_ai_enriched &&
    cached?.watering &&
    cached?.cycle &&
    cached?.description != null &&
    (cached?.thumbnail_url != null || cached?.thumbnail_fetched) &&
    galleryDone
  ) {
    return cached as CachedBotanicalRow;
  }

  // AI-enriched, thumbnail done, gallery not yet fetched — gallery fetch only, skip Claude and thumbnail.
  if (
    cached?.is_ai_enriched &&
    cached?.watering &&
    cached?.cycle &&
    cached?.description != null &&
    (cached?.thumbnail_url != null || cached?.thumbnail_fetched) &&
    !galleryDone &&
    cached?.inat_taxon_id != null &&
    cached.inat_taxon_id > 0
  ) {
    const galleryUrls = await fetchINatGallery(cached.inat_taxon_id, AbortSignal.timeout(8_000));
    const { data: updated, error: galleryError } = await supabase
      .from('cached_botanical_records')
      .update({ gallery_urls: galleryUrls })
      .eq('scientific_name', scientificName)
      .select()
      .single();
    if (galleryError) throw galleryError;
    if (!updated) throw new Error(`Gallery update found no record for: ${scientificName}`);
    return updated as CachedBotanicalRow;
  }

  // AI-enriched but thumbnail not yet attempted — iNaturalist fetch only, skip Claude.
  if (cached?.is_ai_enriched && cached?.watering && cached?.cycle && cached?.description != null) {
    const inat = await fetchINatThumbnail(scientificName, commonName);
    const galleryUrls =
      inat.taxon_id != null && inat.taxon_id > 0
        ? await fetchINatGallery(inat.taxon_id, AbortSignal.timeout(8_000))
        : null;
    const { data: updated, error: thumbError } = await supabase
      .from('cached_botanical_records')
      .update({
        inat_taxon_id: inat.taxon_id ?? null,
        inat_species_id: inat.species_id ?? null,
        inat_rank: inat.rank ?? null,
        thumbnail_url: inat.thumbnail_url,
        regular_url: inat.regular_url,
        thumbnail_fetched: true,
        gallery_urls: galleryUrls,
      })
      .eq('scientific_name', scientificName)
      .select()
      .single();
    if (thumbError) throw thumbError;
    if (!updated) throw new Error(`Thumbnail update found no record for: ${scientificName}`);
    return updated as CachedBotanicalRow;
  }

  // Full enrichment path — Claude AI always runs; iNat skipped when the search pass
  // already populated thumbnail_url (Block B sets thumbnail_fetched=true at search time).
  let parsed: z.infer<typeof EnrichmentSchema>;
  let inat: InatLookupResult & { taxon_id: number | null };
  try {
    const inatFetch =
      cached?.thumbnail_url && cached?.thumbnail_fetched
        ? Promise.resolve({
            taxon_id: cached.inat_taxon_id ?? null,
            species_id: cached.inat_species_id ?? null,
            rank: cached.inat_rank ?? null,
            thumbnail_url: cached.thumbnail_url,
            regular_url: cached.regular_url ?? null,
          })
        : fetchINatThumbnail(scientificName, commonName);

    const [msg, inatResult] = await Promise.all([
      anthropic.messages.parse({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: ENRICHMENT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `${scientificName} / ${commonName}` }],
        output_config: { format: zodOutputFormat(EnrichmentSchema) },
      }),
      inatFetch,
    ]);

    if (!msg.parsed_output) {
      console.error('Claude returned invalid shape for:', scientificName);
      throw new EnrichmentError(`AI returned invalid shape for: ${scientificName}`, 503);
    }
    parsed = msg.parsed_output;
    inat = inatResult;
  } catch (err) {
    // Re-throw EnrichmentErrors as-is so callers see the correct status.
    if (err instanceof EnrichmentError) throw err;
    console.error('Claude enrichment call failed:', err);
    throw new EnrichmentError('Enrichment service unavailable', 503);
  }

  // Fetch gallery photos — separate from the default_photo used for thumbnail.
  // Only fetched when we have a valid taxon ID and gallery has not been populated yet.
  const resolvedTaxonId = inat.taxon_id ?? cached?.inat_taxon_id ?? null;
  const galleryUrls =
    resolvedTaxonId != null && resolvedTaxonId > 0 && cached?.gallery_urls == null
      ? await fetchINatGallery(resolvedTaxonId, AbortSignal.timeout(8_000))
      : (cached?.gallery_urls ?? null);

  // Preserve fields already written by botanical-search (watering, sunlight, cycle) —
  // only fill them from Claude if they are absent, avoiding accidental overwrites.
  const conditionalFields: {
    watering?: string;
    sunlight?: string[];
    cycle?: string;
  } = {};
  if (parsed.watering != null && (cached == null || cached.watering == null)) {
    conditionalFields.watering = parsed.watering;
  }
  if (parsed.sunlight != null && (cached == null || cached.sunlight == null)) {
    conditionalFields.sunlight = parsed.sunlight;
  }
  if (parsed.cycle != null && (cached == null || cached.cycle == null)) {
    conditionalFields.cycle = parsed.cycle;
  }

  const { data: upserted, error: upsertError } = await supabase
    .from('cached_botanical_records')
    .upsert(
      {
        scientific_name: scientificName,
        common_name: toSentenceCase(commonName),
        ideal_min_ph: parsed.ideal_min_ph,
        ideal_max_ph: parsed.ideal_max_ph,
        is_toxic_to_pets: parsed.is_toxic_to_pets,
        toxicity_notes: parsed.toxicity_notes,
        propagation_methods: parsed.propagation_methods,
        check_depth_description: parsed.check_depth_description,
        ideal_humidity_min: parsed.ideal_humidity_min,
        ideal_humidity_max: parsed.ideal_humidity_max,
        care_difficulty: parsed.care_difficulty,
        is_ai_enriched: true,
        description: parsed.description,
        placement: parsed.placement,
        is_tropical: parsed.is_tropical,
        is_toxic_to_humans: parsed.is_toxic_to_humans,
        human_toxicity_notes: parsed.human_toxicity_notes || null,
        produces_fruit: parsed.produces_fruit,
        fruit_season: parsed.fruit_season || null,
        produces_flowers: parsed.produces_flowers,
        flowering_season: parsed.flowering_season || null,
        growth_rate: parsed.growth_rate,
        maintenance_level: parsed.maintenance_level,
        preferred_soil_type: parsed.preferred_soil_type,
        native_region: parsed.native_region,
        max_height_cm: parsed.max_height_cm,
        max_spread_cm: parsed.max_spread_cm,
        air_purifying: parsed.air_purifying,
        inat_taxon_id: inat.taxon_id ?? cached?.inat_taxon_id ?? null,
        inat_species_id: inat.species_id ?? cached?.inat_species_id ?? null,
        inat_rank: inat.rank ?? cached?.inat_rank ?? null,
        thumbnail_url: inat.thumbnail_url,
        regular_url: inat.regular_url,
        thumbnail_fetched: true,
        gallery_urls: galleryUrls,
        ...conditionalFields,
      },
      { onConflict: 'scientific_name' },
    )
    .select()
    .single();

  if (upsertError) throw upsertError;
  if (!upserted) throw new Error(`Enrichment upsert found no record for: ${scientificName}`);
  return upserted as CachedBotanicalRow;
}

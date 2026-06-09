import { createClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { deriveSpeciesId } from '../_shared/inat.ts';
import { fetchINatGallery } from '../_shared/enrich-record.ts';

type BackfillRecord = {
  scientific_name: string;
  common_name: string;
  thumbnail_url: string | null;
  regular_url: string | null;
};

type InatTaxon = {
  id?: number;
  name?: string;
  rank?: string;
  rank_level?: number;
  parent_id?: number;
  default_photo?: { url?: string; medium_url?: string };
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Strips Perenual's non-iNat name decorations down to a canonical "Genus species" binomial.
// Steps are order-dependent: cultivar quotes must come first so authority stripping sees the
// clean name, and all-caps trademarks last so the infraspecific strip doesn't eat them.
function canonicalizeScientificName(rawName: string): string {
  let name = rawName;
  name = name.split("'")[0]; // strip cultivar suffix
  name = name.replace(/\s*\(.*$/, ''); // strip taxonomic authority / cultivar group
  name = name.replace(/\s+(var\.|f\.|subsp\.|ssp\.|cv\.)\s+.+$/, ''); // strip infraspecific rank
  name = name.replace(/(\s+[A-Z]{2,})+$/, ''); // strip trailing all-caps trademark words
  return name.trim().replace(/\s+/g, ' ');
}

// Returns true when the iNat taxon is the same species as the candidate — genus AND species
// epithet must match after normalising hybrid markers (×/x) and case.
// This guards against iNat returning a different-genus result for an ambiguous query.
function isSameSpecies(candidateName: string, inatName: string): boolean {
  const normalize = (n: string) =>
    n
      .toLowerCase()
      .replace(/[×x]\s+/g, '') // collapse hybrid markers to nothing
      .replace(/\s+(var\.|f\.|subsp\.|ssp\.).*$/, '') // drop trailing infraspecific
      .trim();

  const [candGenus = '', candEpithet = ''] = normalize(candidateName).split(' ');
  const [inatGenus = '', inatEpithet = ''] = normalize(inatName).split(' ');

  return candGenus === inatGenus && candEpithet !== '' && candEpithet === inatEpithet;
}

// Single iNat API call. No rank=species so hybrid taxa (stored at rank "hybrid") are found.
// taxon_id=47126 restricts to Plantae, preventing animal or fungal false matches.
async function lookupInat(q: string): Promise<InatTaxon | null> {
  try {
    const resp = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&taxon_id=47126&is_active=true&per_page=1&locale=en`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!resp.ok) {
      console.error(`inat-backfill: iNat HTTP ${resp.status} for "${q}"`);
      return null;
    }
    const data = (await resp.json()) as { results?: InatTaxon[] };
    const taxon = data.results?.[0];
    return taxon?.id ? taxon : null;
  } catch (err) {
    console.error(`inat-backfill: fetch failed for "${q}":`, err);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  // 1. Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // 2. Auth — user-facing function; requires a valid user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // 3. Fetch the next batch of records missing an iNaturalist taxon ID
    const { data: batch, error: batchError } = await supabase
      .from('cached_botanical_records')
      .select('scientific_name, common_name, thumbnail_url, regular_url')
      .is('inat_taxon_id', null)
      .order('scientific_name', { ascending: true })
      .limit(50);

    if (batchError) throw batchError;

    const records = (batch ?? []) as BackfillRecord[];

    // 4. Look up each record in iNaturalist and write the taxon ID back.
    //    Records where iNat has no match are marked inat_taxon_id = -1 (sentinel: confirmed
    //    absent, not a real iNat ID, always < 0) so they are excluded from future batches.
    let processed = 0;

    for (const record of records) {
      const baseName = canonicalizeScientificName(record.scientific_name);
      const isGenusOnly = !baseName.includes(' ');

      if (isGenusOnly) {
        // No species epithet after canonicalization — cannot match a specific iNat taxon.
        await supabase
          .from('cached_botanical_records')
          .update({ inat_taxon_id: -1 })
          .eq('scientific_name', record.scientific_name);
        await delay(200);
        continue;
      }

      // Attempt 1: canonicalized scientific name
      let taxon = await lookupInat(baseName);
      await delay(200);

      // Attempt 2: strip hybrid x-notation (e.g. "Abelia x grandiflora" → "Abelia grandiflora")
      if (!taxon && /\bx\b/i.test(baseName)) {
        const dehybridized = baseName.replace(/\s+x\s+/i, ' ').trim();
        taxon = await lookupInat(dehybridized);
        await delay(200);
      }

      // Verify the iNat result is the same species — genus AND species epithet must match
      // after normalising hybrid markers. Rejects wrong-genus matches that would link a
      // record's AI enrichment to a completely different species.
      const isVerified = taxon?.id != null && isSameSpecies(baseName, taxon.name ?? '');

      if (isVerified) {
        const photo = taxon!.default_photo;
        const speciesId =
          taxon!.rank_level != null
            ? deriveSpeciesId({
                id: taxon!.id!,
                rank_level: taxon!.rank_level,
                parent_id: taxon!.parent_id,
              })
            : null;
        const rank = taxon!.rank ?? null;

        const galleryUrls = await fetchINatGallery(taxon!.id!, AbortSignal.timeout(8_000));

        const { error: updateError } = await supabase
          .from('cached_botanical_records')
          .update({
            inat_taxon_id: taxon!.id!,
            inat_species_id: speciesId,
            inat_rank: rank,
            thumbnail_url: record.thumbnail_url ?? photo?.url ?? null,
            regular_url: record.regular_url ?? photo?.medium_url ?? null,
            thumbnail_fetched: true,
            gallery_urls: galleryUrls,
          })
          .eq('scientific_name', record.scientific_name);

        if (updateError) {
          console.error(
            `inat-backfill: DB update failed for "${record.scientific_name}":`,
            updateError,
          );
        } else {
          processed++;
        }
      } else {
        if (taxon?.id) {
          console.error(
            `inat-backfill: rejecting "${taxon.name}" for "${record.scientific_name}" — species mismatch`,
          );
        }
        await supabase
          .from('cached_botanical_records')
          .update({ inat_taxon_id: -1 })
          .eq('scientific_name', record.scientific_name);
      }
    }

    // 5. Count records still unresolved and confirmed absent
    const [{ count: remaining }, { count: absent }] = await Promise.all([
      supabase
        .from('cached_botanical_records')
        .select('scientific_name', { count: 'exact', head: true })
        .is('inat_taxon_id', null),
      supabase
        .from('cached_botanical_records')
        .select('scientific_name', { count: 'exact', head: true })
        .eq('inat_taxon_id', -1),
    ]);

    return json({ processed, remaining: remaining ?? 0, absent: absent ?? 0 });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

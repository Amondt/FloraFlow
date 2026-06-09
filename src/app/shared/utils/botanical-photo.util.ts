import type { CachedBotanicalRecord } from '../../features/library/library.service';

export function buildGalleryPhotos(rec: CachedBotanicalRecord | null | undefined): string[] {
  if (!rec) return [];
  const urls = new Set<string>();
  if (rec.regular_url) urls.add(rec.regular_url);
  for (const u of rec.gallery_urls ?? []) if (u) urls.add(u);
  return [...urls];
}

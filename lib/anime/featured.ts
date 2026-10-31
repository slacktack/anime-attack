import { anilistFetch } from "./anilist";
import { mapMediaToAnime } from "./anilist-map";
import { getKitsuBackdrop } from "./kitsu";
import * as Q from "./queries";
import type { Anime } from "./types";

export type FeaturedItem = Anime & { malId: number | null; backdrop: string | null };

// One AniList call for the whole hero rotation, plus Kitsu art in parallel.
export async function getFeatured(): Promise<FeaturedItem[]> {
  const data = await anilistFetch<{ Page: { media: Record<string, unknown>[] } }>(Q.FEATURED);
  const media = data?.Page?.media ?? [];
  return Promise.all(
    media.map(async (m) => {
      const malId = typeof m.idMal === "number" ? m.idMal : null;
      return {
        ...mapMediaToAnime(m),
        malId,
        backdrop: malId ? await getKitsuBackdrop(malId) : null,
      };
    }),
  );
}

import { Episode, EpisodeSchema } from "./types";

type Rec = Record<string, any>;

export async function getEpisodesByMal(malId: number): Promise<Episode[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes`, {
      headers: { Accept: "application/json" }, next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: Rec[] };
    return (json.data ?? []).map((e, i) =>
      EpisodeSchema.parse({ number: e.mal_id ?? i + 1, title: e.title ?? null, filler: Boolean(e.filler) }));
  } catch {
    return [];
  }
}

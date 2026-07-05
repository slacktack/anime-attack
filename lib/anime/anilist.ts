import { mapCharacterEdge, mapMediaToAnime, mapMediaToSummary } from "./anilist-map";
import * as Q from "./queries";
import type { Anime, AnimeSummary, Character } from "./types";

const ENDPOINT = "https://graphql.anilist.co";
type Rec = Record<string, any>;

export async function anilistFetch<T>(query: string, variables: Rec = {}): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  } as RequestInit);
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = (await res.json()) as { data: T; errors?: unknown };
  if (json.errors) throw new Error("AniList query error");
  return json.data;
}

const listFrom = (d: Rec): AnimeSummary[] => (d?.Page?.media ?? []).map(mapMediaToSummary);

export const getTrending = () => anilistFetch<Rec>(Q.TRENDING).then(listFrom);
export const getTopAiring = () => anilistFetch<Rec>(Q.TOP_AIRING).then(listFrom);
export const getPopularMovies = () => anilistFetch<Rec>(Q.POPULAR_MOVIES).then(listFrom);
export const searchAnime = (q: string, page = 1) =>
  anilistFetch<Rec>(Q.SEARCH, { q, page }).then(listFrom);
export const getAnimeDetails = (id: number): Promise<Anime> =>
  anilistFetch<Rec>(Q.DETAILS, { id }).then((d) => mapMediaToAnime(d.Media));
export const getCharacters = (id: number): Promise<Character[]> =>
  anilistFetch<Rec>(Q.CHARACTERS, { id }).then((d) => (d?.Media?.characters?.edges ?? []).map(mapCharacterEdge));
export const getRecommendations = (id: number): Promise<AnimeSummary[]> =>
  anilistFetch<Rec>(Q.RECOMMENDATIONS, { id }).then((d) =>
    (d?.Media?.recommendations?.nodes ?? [])
      .map((n: Rec) => n.mediaRecommendation).filter(Boolean).map(mapMediaToSummary));

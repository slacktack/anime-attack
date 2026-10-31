"use client";

/**
 * Client access to the app's own data API (app/api/**).
 *
 * Everything the UI renders goes through these helpers so that:
 *  - responses are cached (s-maxage) instead of hammering upstreams,
 *  - one JSON contract can later be reused by a mobile client,
 *  - upstream quirks (referer gates, 400s, dead hosts) stay server-side.
 */

import type { Anime, AnimeSummary, Character, RelatedAnime } from "@/lib/anime/types";
import type { CharacterCard, CharacterFull, ScheduleEntry } from "@/lib/anime/extra-types";
import type { AniwatchEpisode } from "@/lib/anime/aniwatch-types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

/* ── Discovery ──────────────────────────────────────────────── */

export type DiscoverKind = "trending" | "airing" | "movies";

export function fetchDiscover(kind: DiscoverKind): Promise<AnimeSummary[]> {
  return getJson<{ items: AnimeSummary[] }>(`/api/anime/discover?kind=${kind}`).then(
    (d) => d.items ?? [],
  );
}

export function fetchSearch(q: string): Promise<AnimeSummary[]> {
  return getJson<{ items: AnimeSummary[] }>(
    `/api/anime/discover?kind=search&q=${encodeURIComponent(q)}`,
  ).then((d) => d.items ?? []);
}

export type BrowseFilters = {
  genre?: string;
  year?: number;
  format?: string;
  status?: string;
  sort?: string;
};

export function fetchBrowse(filters: BrowseFilters): Promise<AnimeSummary[]> {
  const params = new URLSearchParams({ kind: "browse" });
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.year) params.set("year", String(filters.year));
  if (filters.format) params.set("format", filters.format);
  if (filters.status) params.set("status", filters.status);
  if (filters.sort) params.set("sort", filters.sort);
  return getJson<{ items: AnimeSummary[] }>(`/api/anime/discover?${params}`).then(
    (d) => d.items ?? [],
  );
}

/* ── Detail ─────────────────────────────────────────────────── */

export type AnimeDetailPayload = {
  anime: Anime;
  malId: number | null;
  accentColor: string | null;
  backdrop?: string | null;
  relations: RelatedAnime[];
  characters: Character[];
  recommendations: AnimeSummary[];
};

export function fetchAnimeDetail(id: number): Promise<AnimeDetailPayload> {
  return getJson<AnimeDetailPayload>(`/api/anime/${id}`);
}

/* ── Episodes ───────────────────────────────────────────────── */

export type WatchEpisodesResponse = {
  malId: number;
  anilistId: number | null;
  title: string;
  format: string | null;
  totalEpisodes: number | null;
  year: number | null;
  isMovie: boolean;
  episodes: { number: number; title: string | null; filler: boolean }[];
  source: "jikan" | "generated" | "anilist";
};

export function fetchWatchEpisodes(malId: number): Promise<WatchEpisodesResponse> {
  return getJson<WatchEpisodesResponse>(`/api/anime/episodes?mal=${malId}`);
}

/* ── Characters ─────────────────────────────────────────────── */

export function fetchCharacters(page = 1, q?: string): Promise<CharacterCard[]> {
  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  return getJson<{ items: CharacterCard[] }>(`/api/characters?${params}`).then(
    (d) => d.items ?? [],
  );
}

export function fetchCharacterFull(id: number): Promise<CharacterFull> {
  return getJson<{ character: CharacterFull }>(`/api/characters/${id}`).then(
    (d) => d.character,
  );
}

/* ── Schedule ───────────────────────────────────────────────── */

export function fetchSchedule(): Promise<ScheduleEntry[]> {
  return getJson<{ items: ScheduleEntry[] }>("/api/schedule").then((d) => d.items ?? []);
}

/* ── aniwatch feed ──────────────────────────────────────────── */

export function fetchLatestEpisodes(page = 1, perPage = 12): Promise<AniwatchEpisode[]> {
  return getJson<{ items: AniwatchEpisode[] }>(
    `/api/anime/latest?page=${page}&per_page=${perPage}`,
  ).then((d) => d.items ?? []);
}

export function fetchEpisodeSearch(q: string): Promise<AniwatchEpisode[]> {
  return getJson<{ items: AniwatchEpisode[] }>(
    `/api/anime/latest?q=${encodeURIComponent(q)}`,
  ).then((d) => d.items ?? []);
}

/* ── Seasons ────────────────────────────────────────────────── */

export type SeasonEntry = {
  id: number;
  title: string;
  cover: string;
  format: string | null;
  year: number | null;
  episodes: number | null;
  status: string | null;
  season: number | null;
  current: boolean;
};

export function fetchSeasons(id: number): Promise<{ seasons: SeasonEntry[]; extras: SeasonEntry[] }> {
  return getJson(`/api/anime/${id}/seasons`);
}

/* ── Featured (home hero) ───────────────────────────────────── */

export type FeaturedItem = Anime & { malId: number | null; backdrop: string | null };

export function fetchFeatured(): Promise<FeaturedItem[]> {
  return getJson<{ items: FeaturedItem[] }>(`/api/anime/featured`).then((d) => d.items ?? []);
}

/* ── Episode titles + thumbnails (Kitsu) ────────────────────── */

export type EpisodeMeta = { number: number; title: string | null; thumbnail: string | null; airdate: string | null };

export function fetchEpisodeMeta(malId: number, from: number, to: number): Promise<EpisodeMeta[]> {
  return getJson<{ items: EpisodeMeta[] }>(`/api/anime/episode-meta?mal=${malId}&from=${from}&to=${to}`).then((d) => d.items ?? []);
}

import { searchAnime } from "./anilist";
import type { AnimeSummary } from "./types";

/**
 * Resolve an episode slug to a MAL id when the aniwatch player iframe no longer
 * exposes one.
 *
 * Current aniwatch posts embed a `player/?source=blogger` indirection instead of
 * a megavid URL, so `megavid/mal/{id}/{ep}` cannot be scraped from the page any
 * more. The reliable route is: slug -> WordPress post title -> AniList search ->
 * idMal, with the episode number parsed from the slug.
 */

const BASE = "https://aniwatchtv.by";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const TTL = 30 * 60_000;
const cache = new Map<string, { expires: number; value: SlugTarget | null }>();

export type SlugTarget = { malId: number; episode: number; title: string };

type WpPost = { title?: { rendered?: string }; slug?: string };

function cleanTitle(input: string): string {
  return input
    .replace(/^\s*\[[^\]]*\]\s*/, "")
    .replace(/\s*[-–|]\s*episode\s*\d+.*$/i, "")
    .replace(/\s*episode\s*\d+.*$/i, "")
    .replace(/\s*(english\s*)?(subbed|dubbed|sub|dub)\b.*$/i, "")
    .replace(/\s*\((?:sub|dub|hd|fhd|\d{3,4}p)\)\s*$/i, "")
    .replace(/&(#\d+|amp|quot|#039);/g, (m) =>
      m === "&amp;" ? "&" : m === "&quot;" ? '"' : m === "&#039;" ? "'" : " ",
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function episodeFromSlug(slug: string): number | null {
  const match =
    slug.match(/-episode-(\d+)/i) ??
    slug.match(/-ep-?(\d+)/i) ??
    slug.match(/-(\d+)(?:st|nd|rd|th)-season-episode-(\d+)/i);
  if (!match) return null;
  const value = Number(match[2] ?? match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function seasonOf(text: string): string | null {
  const match =
    text.match(/\b(?:season|part|cour)\s*(\d+)\b/i) ??
    text.match(/\b(\d+)(?:st|nd|rd|th)\s+season\b/i);
  return match ? match[1] : null;
}

function pickBest(results: AnimeSummary[], title: string): AnimeSummary | null {
  if (results.length === 0) return null;
  const needle = title.toLowerCase();
  const wantedSeason = seasonOf(title);

  const sameSeason = (candidate: AnimeSummary) => {
    if (!wantedSeason) return true;
    return seasonOf(candidate.title) === wantedSeason;
  };

  const exact = results.find((r) => r.title.toLowerCase() === needle);
  if (exact) return exact;

  const sameSeasonAll = results.filter(sameSeason);
  if (sameSeasonAll.length > 0) {
    // Prefer the earliest release of that season: "One Punch Man Season 3 Part 2"
    // is a later, often unaired, entry and would resolve the wrong content.
    return [...sameSeasonAll].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))[0];
  }

  return (
    results.find((r) => r.title.toLowerCase().includes(needle)) ?? results[0]
  );
}

/**
 * `posts?slug=` is dead on the current aniwatch install (always 0 rows), so the
 * title is derived from the slug itself, which is already the post title.
 */
function titleFromSlug(slug: string): string {
  return cleanTitle(slug.replace(/-/g, " "));
}

export async function resolveSlugToMal(slug: string): Promise<SlugTarget | null> {
  const key = slug.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  const fallbackEpisode = episodeFromSlug(slug) ?? 1;
  const candidates: string[] = [];

  const fromSlug = titleFromSlug(slug);
  if (fromSlug) candidates.unshift(fromSlug);

  let value: SlugTarget | null = null;

  for (const candidate of candidates) {
    // Try progressively looser queries: full title, then first few words.
    const queries = [candidate];
    const words = candidate.split(" ").filter(Boolean);
    if (words.length > 4) queries.push(words.slice(0, 4).join(" "));
    if (words.length > 2) queries.push(words.slice(0, 2).join(" "));

    for (const query of queries) {
      try {
        const results = await searchAnime(query, 1);
        const best = pickBest(results, candidate);
        if (!best) continue;

        // AniList search returns AniList ids; the MAL id comes from the detail
        // call, which is cached upstream.
        const { getAnimeExtras } = await import("./anilist-extra");
        const extras = await getAnimeExtras(best.id);
        if (!extras.idMal) continue;

        const episodeMatch = slug.match(/episode-(\d+)/i) ?? slug.match(/-ep-?(\d+)/i);
        const episode = episodeMatch ? Number(episodeMatch[1]) : fallbackEpisode;

        value = { malId: extras.idMal, episode, title: best.title };
        break;
      } catch {
        /* try the next query */
      }
    }
    if (value) break;
  }

  cache.set(key, { expires: Date.now() + (value ? TTL : 15_000), value });
  return value;
}

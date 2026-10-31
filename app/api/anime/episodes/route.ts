import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Everything the watch page needs to navigate episodes without leaving it:
 * the AniList entry behind a MAL id, its episode count, and the episode list.
 */

type Rec = Record<string, any>;

const ANILIST = "https://graphql.anilist.co";

const QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      id
      idMal
      format
      status
      episodes
      seasonYear
      status
      nextAiringEpisode { episode }
      title { english romaji native }
    }
  }`;

export type WatchEpisode = { number: number; title: string | null; filler: boolean };

export type WatchEpisodesPayload = {
  malId: number;
  anilistId: number | null;
  title: string;
  format: string | null;
  totalEpisodes: number | null;
  year: number | null;
  isMovie: boolean;
  episodes: WatchEpisode[];
  source: "jikan" | "generated" | "anilist";
};

async function anilistByMal(malId: number): Promise<Rec | null> {
  try {
    const res = await fetch(ANILIST, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { idMal: malId } }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { Media?: Rec } };
    return json.data?.Media ?? null;
  } catch {
    return null;
  }
}

// Jikan stalls often; remember that it just failed so we do not pay the timeout
// on every request for the same anime.
const jikanCooldown = new Map<number, number>();
const JIKAN_COOLDOWN_MS = 5 * 60_000;

async function jikanEpisodes(malId: number): Promise<WatchEpisode[]> {
  const until = jikanCooldown.get(malId);
  if (until && until > Date.now()) return [];
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes`, {
      headers: { Accept: "application/json" },
      // Jikan regularly stalls for 10s+; a slow list is worse than a generated one,
      // so give up quickly and fall back to numbering from the AniList count.
      signal: AbortSignal.timeout(4000),
      next: { revalidate: 3600 },
    } as RequestInit);
    if (!res.ok) {
      jikanCooldown.set(malId, Date.now() + JIKAN_COOLDOWN_MS);
      return [];
    }
    const json = (await res.json()) as { data?: Rec[] };
    return (json.data ?? []).map((e, i) => ({
      number: typeof e?.mal_id === "number" ? e.mal_id : i + 1,
      title: typeof e?.title === "string" ? e.title : null,
      filler: Boolean(e?.filler),
    }));
  } catch {
    jikanCooldown.set(malId, Date.now() + JIKAN_COOLDOWN_MS);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const malId = Number(request.nextUrl.searchParams.get("mal"));
  if (!Number.isFinite(malId) || malId <= 0) {
    return NextResponse.json({ error: "Valid ?mal= is required" }, { status: 400 });
  }

  const media = await anilistByMal(malId);
  const announced = typeof media?.episodes === "number" ? media.episodes : null;
  const nextAiring = typeof media?.nextAiringEpisode?.episode === "number"
    ? media.nextAiringEpisode.episode
    : null;
  const status = typeof media?.status === "string" ? media.status : null;

  // Long-running shows report no total. Use the announced count, else the next
  // airing episode as the aired-so-far lower bound, else a generous floor so the
  // episode grid can still be navigated and jumped through.
  const total = announced ?? (nextAiring != null ? Math.max(nextAiring - 1, 1) : null);
  const format = typeof media?.format === "string" ? media.format : null;
  const isMovie = format === "MOVIE" || total === 1;

  let episodes = await jikanEpisodes(malId);
  let source: WatchEpisodesPayload["source"] = "jikan";

  if (episodes.length === 0 && !total && status === "RELEASING") {
    const floor = 500;
    episodes = Array.from({ length: floor }, (_, index) => ({
      number: index + 1,
      title: null,
      filler: false,
    }));
    source = "generated";
  }

  if (episodes.length === 0 && total && total > 0) {
    const count = Math.min(total, 2000);
    episodes = Array.from({ length: count }, (_, index) => ({
      number: index + 1,
      title: count === 1 ? "Movie" : null,
      filler: false,
    }));
    source = "generated";
  }

  const payload: WatchEpisodesPayload = {
    malId,
    anilistId: typeof media?.id === "number" ? media.id : null,
    title:
      media?.title?.english || media?.title?.romaji || media?.title?.native || "Anime",
    format,
    totalEpisodes: total ?? (episodes.length || null),
    year: typeof media?.seasonYear === "number" ? media.seasonYear : null,
    isMovie,
    episodes,
    source,
  };

  // AniList miss or rate-limit: don't pin an empty shell in the CDN for 15 minutes
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": media ? "public, s-maxage=900, stale-while-revalidate=3600" : "no-store",
    },
  });
}

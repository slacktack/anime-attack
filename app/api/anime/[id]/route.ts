import { NextResponse } from "next/server";
import {
  getAnimeDetails,
  getCharacters,
  getRecommendations,
  getRelations,
} from "@/lib/anime/anilist";
import { getAnimeExtras } from "@/lib/anime/anilist-extra";
import { getKitsuBackdrop } from "@/lib/anime/kitsu";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Everything the detail page needs in one round trip:
 * the AniList entry, MAL id, season family, cast and recommendations.
 * Sections that fail degrade to empty arrays instead of failing the request.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anime id" }, { status: 400 });
  }

  const settle = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  };

  try {
    const extrasP = settle(() => getAnimeExtras(id), { idMal: null as number | null, color: null as string | null });
    const backdropP = extrasP.then((e) => (e.idMal ? getKitsuBackdrop(e.idMal) : null));
    const [anime, extras, backdrop, relations, characters, recommendations] = await Promise.all([
      getAnimeDetails(id),
      extrasP,
      backdropP,
      settle(() => getRelations(id), []),
      settle(() => getCharacters(id), []),
      settle(() => getRecommendations(id), []),
    ]);

    return NextResponse.json(
      {
        anime,
        malId: extras.idMal,
        accentColor: extras.color,
        backdrop,
        relations,
        characters,
        recommendations,
      },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Anime lookup failed" },
      { status: 502 },
    );
  }
}

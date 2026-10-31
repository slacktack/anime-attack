import { type NextRequest, NextResponse } from "next/server";
import {
  getTrending,
  getTopAiring,
  getPopularMovies,
  searchAnime,
} from "@/lib/anime/anilist";
import { browseAnime } from "@/lib/anime/anilist-extra";

export const runtime = "nodejs";
export const maxDuration = 30;

const HEADERS = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" };

/**
 * One discovery endpoint for the whole app.
 *   /api/anime/discover?kind=trending|airing|movies|search|browse
 * Search/browse accept q, genre, year, format, status, sort.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind") ?? "trending";

  try {
    if (kind === "search") {
      const q = (params.get("q") ?? "").trim();
      if (q.length < 2) {
        return NextResponse.json({ items: [] }, { headers: HEADERS });
      }
      const page = Math.max(1, Number(params.get("page")) || 1);
      const items = await searchAnime(q, page);
      return NextResponse.json({ items, kind, q, page }, { headers: HEADERS });
    }

    if (kind === "browse") {
      const items = await browseAnime({
        genre: params.get("genre") ?? undefined,
        year: params.get("year") ? Number(params.get("year")) : undefined,
        format: params.get("format") ?? undefined,
        status: params.get("status") ?? undefined,
        sort: params.get("sort") ?? "POPULARITY_DESC",
      });
      return NextResponse.json({ items, kind }, { headers: HEADERS });
    }

    const items =
      kind === "airing"
        ? await getTopAiring()
        : kind === "movies"
          ? await getPopularMovies()
          : await getTrending();

    return NextResponse.json({ items, kind }, { headers: HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Discovery failed", items: [] },
      { status: 502 },
    );
  }
}

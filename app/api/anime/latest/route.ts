import { type NextRequest, NextResponse } from "next/server";
import { fetchLatestEpisodes, searchPosts } from "@/lib/anime/aniwatch";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Fresh episodes from the aniwatch WordPress feed, plus title search over it. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const perPage = Math.min(30, Math.max(1, Number(params.get("per_page")) || 12));

  try {
    const items = q ? await searchPosts(q) : await fetchLatestEpisodes(page, perPage);
    return NextResponse.json(
      { items, q: q ?? null, page },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feed unavailable", items: [] },
      { status: 502 },
    );
  }
}

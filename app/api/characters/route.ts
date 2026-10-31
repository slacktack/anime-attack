import { type NextRequest, NextResponse } from "next/server";
import { browseCharacters } from "@/lib/anime/anilist-extra";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const q = params.get("q")?.trim() || undefined;

  try {
    const items = await browseCharacters(page, q);
    return NextResponse.json(
      { items, page },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Character lookup failed", items: [] },
      { status: 502 },
    );
  }
}

import { type NextRequest, NextResponse } from "next/server";
import { getEpisodeMeta } from "@/lib/anime/kitsu-episodes";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const mal = Number(p.get("mal"));
  const from = Number(p.get("from")) || 1;
  const to = Number(p.get("to")) || from + 59;
  if (!mal || mal <= 0) return NextResponse.json({ error: "Invalid mal id" }, { status: 400 });
  const items = await getEpisodeMeta(mal, from, to);
  return NextResponse.json(
    { items },
    { headers: { "Cache-Control": items.length ? "public, s-maxage=86400, stale-while-revalidate=604800" : "public, s-maxage=600" } },
  );
}

import { NextResponse } from "next/server";
import { getSeasonFamily } from "@/lib/anime/seasons";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid anime id" }, { status: 400 });
  }
  try {
    const family = await getSeasonFamily(id);
    return NextResponse.json(family, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Couldn't load seasons" }, { status: 502 });
  }
}

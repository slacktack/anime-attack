import { NextResponse } from "next/server";
import { getCharacterFull } from "@/lib/anime/anilist-extra";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid character id" }, { status: 400 });
  }

  try {
    const character = await getCharacterFull(id);
    return NextResponse.json(
      { character },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Character lookup failed" },
      { status: 502 },
    );
  }
}

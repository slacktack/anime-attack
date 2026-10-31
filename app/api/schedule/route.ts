import { NextResponse } from "next/server";
import { getSchedule } from "@/lib/anime/anilist-extra";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  try {
    const items = await getSchedule();
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Schedule lookup failed", items: [] },
      { status: 502 },
    );
  }
}

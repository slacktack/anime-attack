import { NextResponse } from "next/server";
import { getFeatured } from "@/lib/anime/featured";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function GET() {
  try {
    const items = await getFeatured();
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Featured lookup failed" },
      { status: 502 },
    );
  }
}

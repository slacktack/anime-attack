import { type NextRequest, NextResponse } from "next/server";
import { listManga } from "@/lib/manga/mangadex";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q") ?? "";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const order = params.get("order") === "latest" ? "latest" : "popular";

  try {
    const data = await listManga({ query, page, order, limit: 24 });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manga search failed" },
      { status: 502 },
    );
  }
}

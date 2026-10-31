import { NextResponse } from "next/server";
import { getMangaDetail } from "@/lib/manga/mangadex";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid manga id" }, { status: 400 });
  }
  try {
    const data = await getMangaDetail(id);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load manga" },
      { status: 502 },
    );
  }
}

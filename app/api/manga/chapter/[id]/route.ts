import { NextResponse } from "next/server";
import { getReaderData } from "@/lib/manga/mangadex";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid chapter id" }, { status: 400 });
  }
  try {
    const data = await getReaderData(id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load chapter" },
      { status: 502 },
    );
  }
}

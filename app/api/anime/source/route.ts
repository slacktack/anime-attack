import { type NextRequest, NextResponse } from "next/server";
import { fetchMegaSource, resolveTargetFromSlug, type MegaAudio } from "@/lib/anime/mega";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = params.get("slug");
  const audioParam = params.get("audio");
  const provider = params.get("provider") ?? undefined;
  const refresh = params.get("refresh") === "1";

  let malId = Number(params.get("mal")) || null;
  let episode = Number(params.get("ep")) || null;
  let audio: MegaAudio = audioParam === "dub" ? "dub" : "sub";

  try {
    if (!malId || !episode) {
      if (!slug) return noStore({ status: "error", message: "Missing slug, mal and ep" }, 400);
      const target = await resolveTargetFromSlug(slug);
      malId = target.malId;
      episode = target.episode;
      if (!audioParam) audio = target.audio;
    }

    if (!malId || episode <= 0) {
      return noStore({ status: "error", message: "Invalid anime or episode number" }, 400);
    }

    const result = await fetchMegaSource({
      malId,
      episode,
      audio,
      provider,
      refresh,
    });

    return noStore(result);
  } catch (error) {
    return noStore(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Could not fetch the stream",
      },
      502,
    );
  }
}

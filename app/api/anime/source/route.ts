import { type NextRequest, NextResponse } from "next/server";
import { fetchMegaSource, resolveTargetFromSlug, type MegaAudio } from "@/lib/anime/mega";
import { resolveSlugToMal } from "@/lib/anime/slug-resolve";

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
    if ((!malId || !episode) && slug) {
      // Preferred path: scrape the player iframe (still works on older posts).
      try {
        const target = await resolveTargetFromSlug(slug);
        malId = target.malId;
        episode = target.episode;
        if (!audioParam) audio = target.audio;
      } catch {
        // Current posts hide the megavid URL behind a player indirection, so fall
        // back to title matching: slug -> post title -> AniList -> idMal.
        const resolved = await resolveSlugToMal(slug);
        if (resolved) {
          malId = malId ?? resolved.malId;
          episode = episode ?? resolved.episode;
        }
      }
    }

    if (!malId || !episode) {
      return noStore(
        {
          status: "error",
          message:
            "Could not work out which anime this episode belongs to. Open it from the anime page.",
        },
        404,
      );
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

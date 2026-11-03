import { type NextRequest, NextResponse } from "next/server";
import { fetchMegaSource, resolveTargetFromSlug, type MegaAudio } from "@/lib/anime/mega";
import { resolveSlugToMal } from "@/lib/anime/slug-resolve";
import { findMirror, isMovieOnAnilist, minMinutesFor } from "@/lib/anime/stream-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mirrorPayload(url: string, malId: number, episode: number, audio: MegaAudio) {
  return {
    status: "ok",
    type: "mp4",
    source: url,
    tracks: [],
    providers: [],
    provider: "aniwatch",
    malId,
    episode,
    audio,
    message: "Playing from the aniwatch mirror (single quality).",
  };
}

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
  const isMovie = params.get("movie") === "1";
  // the viewer picked a short clip on purpose from the source list
  const allowShort = params.get("any") === "1";

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

    const movie = isMovie || (episode === 1 && (await isMovieOnAnilist(malId)));

    if (provider === "aniwatch") {
      const url = slug ? await findMirror(slug, episode, audio) : null;
      if (url) return noStore(mirrorPayload(url, malId, episode, audio));
      return noStore({ status: "missing", source: null, tracks: [], providers: [], provider: "aniwatch", malId, episode, audio, type: "hls", message: "The backup mirror doesn't have this one." });
    }

    // a throw here means every megavid provider failed; still try the mirror below
    const result = await fetchMegaSource({ malId, episode, audio, provider, refresh, minMinutes: allowShort ? undefined : minMinutesFor(movie) }).catch(
      (error: unknown) =>
        ({
          status: "error",
          source: null,
          tracks: [],
          providers: [],
          provider: null,
          malId,
          episode,
          audio,
          type: "hls",
          message: error instanceof Error ? error.message : "Every stream provider is unavailable right now.",
        }) as Awaited<ReturnType<typeof fetchMegaSource>>,
    );

    if (result.status === "ok" || result.status === "countdown") return noStore(result);

    // megavid has no copy of this episode. aniwatch still publishes it through a
    // blogger/JW Player indirection that resolves to a signed Google Video MP4,
    // so use that before giving up. Only possible when we know the episode slug.
    if (slug && (result.status === "missing" || result.status === "error")) {
      const url = await findMirror(slug, episode, audio);
      if (url) return noStore({ ...mirrorPayload(url, malId, episode, audio), providers: result.providers });
    }

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

import { type NextRequest, NextResponse } from "next/server";
import { fetchMegaSource, resolveTargetFromSlug, type MegaAudio } from "@/lib/anime/mega";
import { resolveSlugToMal } from "@/lib/anime/slug-resolve";
import { extractVideoUrl } from "@/lib/anime/aniwatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// aniwatch names posts "<series>-episode-<n>-english-subbed"; our links use the AniList title.
function aniwatchSlugs(slug: string, episode: number, audio: MegaAudio): string[] {
  const suffix = audio === "dub" ? "dubbed" : "subbed";
  const out = new Set<string>();
  if (/-english-(subbed|dubbed)$/i.test(slug)) out.add(slug);
  const base = slug.replace(/-episode-?\d+.*$/i, "");
  const bases = new Set([
    base,
    base.replace(/-(19|20)\d{2}$/, ""),
    base.replace(/-season-\d+$/, ""),
    base.replace(/-(19|20)\d{2}$/, "").replace(/-season-\d+$/, ""),
  ]);
  for (const b of bases) if (b) out.add(`${b}-episode-${episode}-english-${suffix}`);
  return [...out].slice(0, 4);
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

    // a throw here means every megavid provider failed; still try the mirror below
    const result = await fetchMegaSource({ malId, episode, audio, provider, refresh }).catch(
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
      for (const candidate of aniwatchSlugs(slug, episode, audio)) {
      try {
        const fallback = await extractVideoUrl(candidate);
        if (fallback.videoUrl) {
          return noStore({
            ...result,
            status: "ok",
            type: "mp4",
            source: fallback.videoUrl,
            tracks: [],
            provider: "aniwatch",
            message: "Playing from the aniwatch mirror (single quality).",
          });
        }
      } catch {
        /* try the next slug shape */
      }
      }
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

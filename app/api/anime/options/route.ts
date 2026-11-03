import { type NextRequest, NextResponse } from "next/server";
import { fetchMegaSource, playlistMinutes, type MegaAudio } from "@/lib/anime/mega";
import { findMirror, isMovieOnAnilist, minMinutesFor } from "@/lib/anime/stream-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export type StreamOption = {
  audio: MegaAudio;
  provider: "megavid" | "aniwatch";
  minutes: number | null;
  short: boolean;
};

async function megaOption(malId: number, episode: number, audio: MegaAudio, min: number): Promise<StreamOption | null> {
  const src = await fetchMegaSource({ malId, episode, audio }).catch(() => null);
  if (src?.status !== "ok" || !src.source) return null;
  const minutes = src.type === "hls" ? await playlistMinutes(src.source) : null;
  return { audio, provider: "megavid", minutes, short: min > 0 && minutes !== null && minutes < min };
}

async function mirrorOption(slug: string, episode: number, audio: MegaAudio): Promise<StreamOption | null> {
  const url = await Promise.race([
    findMirror(slug, episode, audio),
    new Promise<null>((r) => setTimeout(() => r(null), 20_000)),
  ]);
  return url ? { audio, provider: "aniwatch", minutes: null, short: false } : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const malId = Number(params.get("mal")) || 0;
  const episode = Number(params.get("ep")) || 0;
  const slug = params.get("slug") ?? "";
  if (!malId || episode <= 0) return NextResponse.json({ error: "mal and ep required" }, { status: 400 });

  const movie = episode === 1 && (await isMovieOnAnilist(malId));
  const min = minMinutesFor(movie);
  const audios: MegaAudio[] = ["sub", "dub"];
  const results = await Promise.all([
    ...audios.map((a) => megaOption(malId, episode, a, min)),
    ...(slug ? audios.map((a) => mirrorOption(slug, episode, a)) : []),
  ]);
  const options = results.filter((o): o is StreamOption => o !== null);
  return NextResponse.json(
    { movie, options },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
  );
}

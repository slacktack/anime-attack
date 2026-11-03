import { extractVideoUrl } from "./aniwatch";
import type { MegaAudio } from "./mega";

// aniwatch names posts "<series>-episode-<n>-english-subbed"; our links use the AniList title.
export function aniwatchSlugs(slug: string, episode: number, audio: MegaAudio): string[] {
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

export async function findMirror(slug: string, episode: number, audio: MegaAudio): Promise<string | null> {
  for (const candidate of aniwatchSlugs(slug, episode, audio)) {
    try {
      const found = await extractVideoUrl(candidate);
      if (found.videoUrl) return found.videoUrl;
    } catch {
      /* try the next slug shape */
    }
  }
  return null;
}

export async function isMovieOnAnilist(malId: number): Promise<boolean> {
  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: "query($m:Int){Media(idMal:$m,type:ANIME){format}}", variables: { m: malId } }),
      signal: AbortSignal.timeout(3000),
      next: { revalidate: 86400 },
    } as RequestInit);
    const json = (await res.json()) as { data?: { Media?: { format?: string } } };
    return json.data?.Media?.format === "MOVIE";
  } catch {
    return false;
  }
}

// A "movie" shorter than this is a trailer; TV gets no floor (short-format series exist).
export const minMinutesFor = (movie: boolean) => (movie ? 20 : 0);

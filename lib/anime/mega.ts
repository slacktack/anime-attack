import { lookup } from "node:dns/promises";

export type MegaAudio = "sub" | "dub";

export type MegaTrack = {
  file: string;
  label: string;
  kind: string;
  default?: boolean;
  srcLang?: string;
};

export type MegaProvider = {
  id: string;
  tip: string;
  hard: boolean;
};

export type MegaSource = {
  status: "ok" | "missing" | "countdown" | "error";
  source: string | null;
  type: "hls" | "mp4";
  tracks: MegaTrack[];
  providers: MegaProvider[];
  provider: string | null;
  malId: number;
  episode: number;
  audio: MegaAudio;
  message?: string;
  countdownUrl?: string;
};

type RawMegaSource = {
  status?: string;
  source?: string;
  type?: string;
  tracks?: MegaTrack[];
  providers?: MegaProvider[];
  message?: string;
  iframeUrl?: string;
};

const MEGA_BASE = "https://megavid.buzz";
const ANIWATCH_BASE = "https://aniwatchtv.by";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
// `?axsv=` is effectively a boolean switch: only "loli" returns a working CDN
// (cp.megavid.buzz). Every other value - zuna, yuki, nero, sora, mega, nonsense -
// answers status:"ok" pointing at s-90.megavid.se, which is NXDOMAIN. Keeping the
// dead ids only added ~3-9s of timeout latency per failure.
const PROVIDER_ORDER = ["loli"];
const SOURCE_TTL = 90_000;
const TARGET_TTL = 10 * 60_000;

const sourceCache = new Map<string, { expires: number; value: MegaSource }>();
const targetCache = new Map<string, { expires: number; value: ResolvedTarget }>();

export type ResolvedTarget = {
  malId: number;
  episode: number;
  audio: MegaAudio;
  playerUrl: string;
  title?: string;
};

function cleanSlug(slug: string): string {
  return slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

async function get(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Referer: `${MEGA_BASE}/`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });
}

async function resolveHost(host: string, timeoutMs = 1500): Promise<boolean> {
  try {
    await Promise.race([
      lookup(host),
      new Promise((_, reject) => setTimeout(() => reject(new Error("dns timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function filterTracks(tracks: MegaTrack[]): Promise<MegaTrack[]> {
  if (tracks.length === 0) return tracks;
  const checks = await Promise.all(
    tracks.slice(0, 12).map(async (track) => {
      try {
        const host = new URL(track.file).hostname;
        return (await resolveHost(host)) ? track : null;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter((t): t is MegaTrack => t !== null);
}

async function fetchSourceRaw(
  malId: number,
  episode: number,
  audio: MegaAudio,
  provider: string,
): Promise<RawMegaSource | null> {
  const url = `${MEGA_BASE}/mal/${malId}/${episode}/${audio}/source?axsv=${encodeURIComponent(provider)}`;
  try {
    const res = await get(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as RawMegaSource;
  } catch {
    return null;
  }
}

async function isValidPlaylist(url: string): Promise<boolean> {
  if (!url.startsWith("http")) return false;
  try {
    const res = await get(url, { headers: { Range: "bytes=0-512" } });
    if (!res.ok) return false;
    const text = await res.text();
    return text.trimStart().startsWith("#EXTM3U");
  } catch {
    return false;
  }
}

export async function fetchMegaSource(opts: {
  malId: number;
  episode: number;
  audio: MegaAudio;
  provider?: string;
  refresh?: boolean;
}): Promise<MegaSource> {
  const { malId, episode, audio, provider, refresh } = opts;
  const cacheKey = `${malId}:${episode}:${audio}:${provider ?? "auto"}`;
  const cached = sourceCache.get(cacheKey);
  if (!refresh && cached && cached.expires > Date.now()) return cached.value;

  const order = provider
    ? [provider, ...PROVIDER_ORDER.filter((p) => p !== provider)]
    : PROVIDER_ORDER;

  let last: MegaSource | null = null;

  for (const id of order) {
    const raw = await fetchSourceRaw(malId, episode, audio, id);
    if (!raw) continue;

    const status = (raw.status ?? "error") as MegaSource["status"];
    const tracks = await filterTracks(Array.isArray(raw.tracks) ? raw.tracks : []);
    const providers = Array.isArray(raw.providers) ? raw.providers : [];

    if (status === "countdown" && raw.iframeUrl) {
      const value: MegaSource = {
        status,
        source: null,
        type: "hls",
        tracks: [],
        providers,
        provider: id,
        malId,
        episode,
        audio,
        countdownUrl: raw.iframeUrl,
        message: raw.message,
      };
      sourceCache.set(cacheKey, { expires: Date.now() + 30_000, value });
      return value;
    }

    if (status === "ok" && raw.source) {
      const valid = await isValidPlaylist(raw.source);
      if (!valid) continue;
      const value: MegaSource = {
        status: "ok",
        source: raw.source,
        type: raw.type === "mp4" ? "mp4" : "hls",
        tracks,
        providers,
        provider: id,
        malId,
        episode,
        audio,
        message: raw.message,
      };
      sourceCache.set(cacheKey, { expires: Date.now() + SOURCE_TTL, value });
      return value;
    }

    last = {
      status: status === "missing" ? "missing" : "error",
      source: null,
      type: "hls",
      tracks,
      providers,
      provider: id,
      malId,
      episode,
      audio,
      message: raw.message,
    };

    if (status === "missing" && audio === "sub") break;
  }

  if (last) {
    sourceCache.set(cacheKey, { expires: Date.now() + 15_000, value: last });
    return last;
  }

  throw new Error("Every stream provider is unavailable right now. Try again in a moment.");
}

export async function resolveTargetFromSlug(slug: string): Promise<ResolvedTarget> {
  const safe = cleanSlug(slug);
  if (!safe) throw new Error("Invalid episode slug");

  const cached = targetCache.get(safe);
  if (cached && cached.expires > Date.now()) return cached.value;

  const pageRes = await get(`${ANIWATCH_BASE}/${safe}/`, { headers: { Referer: `${ANIWATCH_BASE}/` } });
  if (!pageRes.ok) {
    throw new Error(`Episode page not found (${pageRes.status})`);
  }
  const pageHtml = await pageRes.text();

  const titleMatch = pageHtml.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/\s*[-–|].*$/, "").trim() : undefined;

  const iframeMatch = pageHtml.match(/<iframe[^>]*src="([^"]+)"/i);
  if (!iframeMatch) throw new Error("No player found on the episode page");

  const playerUrl = iframeMatch[1];
  const direct = playerUrl.match(/megavid\.buzz\/mal\/(\d+)\/(\d+)\/(sub|dub)/i);

  let malId: number | null = direct ? Number(direct[1]) : null;
  let episode: number | null = direct ? Number(direct[2]) : null;
  let audio: MegaAudio = direct ? (direct[3].toLowerCase() as MegaAudio) : "sub";

  if (!malId || !episode) {
    const playerRes = await get(playerUrl, { headers: { Referer: `${ANIWATCH_BASE}/` } });
    if (playerRes.ok) {
      const playerHtml = await playerRes.text();
      const nested = playerHtml.match(/<iframe[^>]*src="([^"]+)"/i);
      const mega =
        nested?.[1].match(/megavid\.buzz\/mal\/(\d+)\/(\d+)\/(sub|dub)/i) ??
        playerHtml.match(/megavid\.buzz\/mal\/(\d+)\/(\d+)\/(sub|dub)/i);
      if (mega) {
        malId = Number(mega[1]);
        episode = Number(mega[2]);
        audio = mega[3].toLowerCase() as MegaAudio;
      }
    }
  }

  if (!malId || !episode) {
    const fallbackEp = safe.match(/episode-(\d+)/i);
    throw new Error(
      fallbackEp
        ? "Could not resolve this episode. Open it from the anime page instead."
        : "Could not resolve this episode source",
    );
  }

  const value: ResolvedTarget = { malId, episode, audio, playerUrl, title };
  targetCache.set(safe, { expires: Date.now() + TARGET_TTL, value });
  return value;
}

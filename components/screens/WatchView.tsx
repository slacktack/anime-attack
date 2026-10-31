"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  VolumeX,
} from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { EpisodeList } from "@/components/screens/EpisodeList";
import { SeasonSelect } from "@/components/screens/SeasonSwitcher";
import { fetchAnimeDetail, fetchWatchEpisodes } from "@/lib/client/api";
import { recordProgress } from "@/lib/storage/store";
import { warmStream } from "@/lib/client/warm";

type Audio = "sub" | "dub";

type SourceTrack = {
  file: string;
  label: string;
  kind: string;
  default?: boolean;
};

type SourceProvider = {
  id: string;
  tip: string;
  hard: boolean;
};

type SourceResponse = {
  status: "ok" | "missing" | "countdown" | "error";
  source: string | null;
  type: "hls" | "mp4";
  tracks: SourceTrack[];
  providers: SourceProvider[];
  provider: string | null;
  malId: number;
  episode: number;
  audio: Audio;
  message?: string;
  countdownUrl?: string;
};

type Props = {
  slug: string;
  malId?: number;
  episode?: number;
  initialAudio?: Audio;
};

const PROVIDER_LABELS: Record<string, string> = {
  loli: "Loli",
  zuna: "Zuna",
  yuki: "Yuki",
  nero: "Nero",
};

function titleFromSlug(slug: string): string {
  const cleaned = slug
    .replace(/-episode-?\d+.*$/i, "")
    .replace(/-(english-)?(subbed|dubbed|sub|dub)$/i, "")
    .replace(/-/g, " ")
    .trim();
  if (!cleaned) return "Watch";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

function proxiedMedia(url: string, mode: "smart" | "full" = "smart"): string {
  return `/api/proxy/media?url=${encodeURIComponent(url)}&ref=${encodeURIComponent(
    "https://megavid.buzz/",
  )}&mode=${mode}`;
}

function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WatchView({ slug, malId, episode, initialAudio }: Props) {
  const [audio, setAudio] = useState<Audio>(
    initialAudio ?? (/dubbed|english-dub/i.test(slug) ? "dub" : "sub"),
  );
  const [provider, setProvider] = useState<string | null>(null);
  const [fullProxy, setFullProxy] = useState(false);
  const [hardError, setHardError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [showResumed, setShowResumed] = useState(false);
  const forceRefresh = useRef(false);
  const tried = useRef(new Set<string>());

  const stream = useQuery({
    queryKey: ["stream", slug, malId, episode, audio, provider, refreshTick],
    queryFn: async (): Promise<SourceResponse> => {
      const params = new URLSearchParams({ slug, audio });
      if (malId) params.set("mal", String(malId));
      if (episode) params.set("ep", String(episode));
      if (provider) params.set("provider", provider);
      // refresh=1 only for the request a Retry triggered
      if (forceRefresh.current) params.set("refresh", "1");
      forceRefresh.current = false;
      const res = await fetch(`/api/anime/source?${params.toString()}`, { cache: "no-store" });
      let json: (SourceResponse & { message?: string }) | null = null;
      try {
        json = await res.json();
      } catch {
        /* non-JSON gateway error */
      }
      if (res.status === 404) {
        throw new Error("Couldn't identify this episode. Open it from the anime's page instead.");
      }
      if (!res.ok || !json) throw new Error(json?.message || `The stream server didn't respond (${res.status}).`);
      return json;
    },
    retry: 1,
    retryDelay: 600,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const data = stream.data;
  const epNumber = data?.episode ?? episode;
  const effMal = malId ?? (data?.malId && data.malId > 0 ? data.malId : undefined);

  // Slug-only arrivals: write the resolved ids into the URL so reloads and shares skip slug resolution.
  useEffect(() => {
    if (malId || !data?.malId || !data.episode) return;
    const url = new URL(window.location.href);
    url.searchParams.set("mal", String(data.malId));
    url.searchParams.set("ep", String(data.episode));
    url.searchParams.set("audio", audio);
    window.history.replaceState(window.history.state, "", url.toString());
  }, [malId, data?.malId, data?.episode, audio]);

  const shelf = useQuery({
    queryKey: ["watch-shelf", effMal],
    queryFn: () => fetchWatchEpisodes(effMal as number),
    enabled: effMal != null,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const anilistId = shelf.data?.anilistId ?? null;
  const meta = useQuery({
    queryKey: ["anime-detail", anilistId],
    queryFn: () => fetchAnimeDetail(anilistId as number),
    enabled: anilistId != null,
    staleTime: 10 * 60 * 1000,
  });
  const anime = meta.data?.anime;

  const showTitle = anime?.title ?? shelf.data?.title ?? titleFromSlug(slug);
  const totalEpisodes = shelf.data?.totalEpisodes ?? anime?.episodes ?? null;
  const currentEp = epNumber ?? 1;
  const hasPrev = currentEp > 1;
  const hasNext = totalEpisodes != null ? currentEp < totalEpisodes : !shelf.data?.isMovie;

  const playable = data?.status === "ok" && !!data.source && !hardError;

  // Continue watching: persist ids, never the signed source URL.
  useEffect(() => {
    if (!anime || !playable || !epNumber) return;
    recordProgress(
      {
        id: anime.id,
        title: anime.title,
        cover: anime.cover,
        banner: anime.banner,
        type: anime.type,
        score: anime.score,
        year: anime.year,
      },
      epNumber,
      effMal ?? null,
    );
  }, [anime, playable, epNumber, effMal]);

  const progressKey =
    data?.malId && data?.episode ? `anime:progress:${data.malId}:${data.episode}` : null;

  useEffect(() => {
    if (!progressKey) return;
    try {
      const saved = Number(window.localStorage.getItem(progressKey) ?? "0");
      if (saved > 5) {
        setStartAt(saved);
        setResumed(true);
        setShowResumed(true);
        const t = window.setTimeout(() => setShowResumed(false), 5000);
        return () => window.clearTimeout(t);
      }
      setStartAt(0);
      setResumed(false);
    } catch {
      setStartAt(0);
    }
  }, [progressKey]);

  useEffect(() => {
    setFullProxy(false);
    setHardError(false);
  }, [audio, provider, refreshTick]);

  useEffect(() => {
    tried.current = new Set();
  }, [slug, episode, audio, refreshTick]);

  const src = useMemo(() => {
    if (!data?.source) return null;
    return proxiedMedia(data.source, fullProxy ? "full" : "smart");
  }, [data?.source, fullProxy]);

  const tracks = useMemo(
    () => (data?.tracks ?? []).map((track) => ({ ...track, file: proxiedMedia(track.file) })),
    [data?.tracks],
  );

  // smart → full → next untried provider → hard error
  const handleFatal = useCallback(() => {
    if (!fullProxy) {
      setFullProxy(true);
      return;
    }
    if (data?.provider) tried.current.add(data.provider);
    // the server fell back instead of honouring our pick: nothing left to try
    if (provider && data?.provider && data.provider !== provider) {
      setHardError(true);
      return;
    }
    const next = (data?.providers ?? []).map((p) => p.id).find((id) => !tried.current.has(id));
    if (next) {
      tried.current.add(next);
      setProvider(next);
      return;
    }
    setHardError(true);
  }, [fullProxy, data, provider]);

  const handleProgress = useCallback(
    (time: number, duration: number) => {
      // pre-resolve the next episode near the end so autoplay-to-next is instant
      if (duration > 0 && time / duration > 0.8 && hasNext && effMal) {
        warmStream({ mal: effMal, ep: currentEp + 1, audio });
      }
      if (!progressKey) return;
      try {
        if (duration > 0 && time / duration > 0.97) window.localStorage.removeItem(progressKey);
        else window.localStorage.setItem(progressKey, String(Math.floor(time)));
      } catch {
        /* storage unavailable */
      }
    },
    [progressKey, hasNext, effMal, currentEp, audio],
  );

  const retry = () => {
    forceRefresh.current = true;
    setHardError(false);
    setFullProxy(false);
    setRefreshTick((tick) => tick + 1);
  };

  const epHref = (n: number) =>
    `/watch/${slugifyTitle(showTitle)}-episode-${n}?${new URLSearchParams({
      ...(effMal ? { mal: String(effMal) } : {}),
      ep: String(n),
      audio,
    }).toString()}`;

  const isLoading = stream.isLoading || (stream.isFetching && !data);
  const status = stream.isError ? "error" : (data?.status ?? null);
  const dubMissing = status === "missing" && audio === "dub";
  const missing = status === "missing" && audio === "sub";
  const countdown = status === "countdown";
  const rawError =
    stream.error instanceof Error ? stream.error.message : (data?.message ?? "This episode isn't available right now.");
  const errorMessage = /every stream provider/i.test(rawError)
    ? "None of our sources has a working copy of this episode right now. Other episodes or the dub may still play."
    : rawError;
  const isMp4Fallback = data?.type === "mp4";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8 2xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0">
        {/* player */}
        <div className="on-media relative -mx-[var(--gutter)] overflow-hidden bg-black sm:mx-0 sm:rounded-xl">
          {playable && src ? (
            <VideoPlayer
              key={`${src}-${audio}`}
              src={src}
              kind={data?.type ?? "hls"}
              title={`${showTitle}${epNumber ? ` · Episode ${epNumber}` : ""}`}
              tracks={tracks}
              startAt={resumed ? startAt : 0}
              onFatal={handleFatal}
              onProgress={handleProgress}
            />
          ) : (
            <div className="relative flex aspect-video w-full flex-col items-center justify-center gap-3 px-6 text-center">
              {anime?.banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={anime.banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm" />
              )}
              <div className="relative flex flex-col items-center gap-3">
                {isLoading || stream.isFetching ? (
                  <>
                    <Loader2 size={34} className="animate-spin text-white/80" />
                    <p className="text-[15px] font-medium text-white/70">Finding a stream…</p>
                  </>
                ) : dubMissing ? (
                  <>
                    <VolumeX size={32} className="text-accent-gold" />
                    <p className="text-[16px] font-semibold text-white">The dub for this episode isn&apos;t out yet</p>
                    <button type="button" onClick={() => setAudio("sub")} className="aa-cta mt-1">
                      <Play size={16} fill="currentColor" /> Watch subbed
                    </button>
                  </>
                ) : countdown ? (
                  <>
                    <Play size={32} className="text-white/70" />
                    <p className="text-[16px] font-semibold text-white">This episode hasn&apos;t aired yet</p>
                    <p className="text-[14px] text-white/60">{data?.message ?? "Check back after it airs."}</p>
                  </>
                ) : missing ? (
                  <>
                    <AlertTriangle size={32} className="text-accent-crimson" />
                    <p className="text-[16px] font-semibold text-white">This episode isn&apos;t at the source</p>
                    {data?.message && <p className="max-w-sm text-[14px] text-white/60">{data.message}</p>}
                    <button type="button" onClick={retry} className="aa-cta-ghost mt-1">
                      <RefreshCw size={16} /> Try again
                    </button>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={32} className="text-accent-crimson" />
                    <p className="text-[16px] font-semibold text-white">
                      {hardError ? "Every server failed on this episode" : "The stream didn't start"}
                    </p>
                    <p className="max-w-md text-[14px] text-white/60">
                      {hardError ? "The source is likely down for a moment. Retry in a few seconds." : errorMessage}
                    </p>
                    <button type="button" onClick={retry} className="aa-cta mt-1">
                      <RefreshCw size={16} /> Retry
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {showResumed && resumed && (
            <div className="pointer-events-none absolute bottom-16 left-3 z-40 flex items-center gap-1.5 rounded-md bg-black/80 px-3 py-1.5 text-[12.5px] font-semibold text-white">
              <Play size={11} fill="currentColor" /> Resumed at {formatTime(startAt)}
            </div>
          )}
        </div>

        {/* title + controls */}
        <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-accent-purple">
              {shelf.data?.isMovie ? "Movie" : `Episode ${currentEp}`}
              {totalEpisodes && !shelf.data?.isMovie ? <span className="text-muted"> of {totalEpisodes}</span> : null}
            </p>
            <h1 className="mt-1 font-display text-[24px] font-bold leading-tight tracking-[-0.03em] sm:text-[30px]">
              {anilistId ? (
                <Link href={`/anime/${anilistId}`} className="inline-flex items-center gap-1 hover:underline">
                  {showTitle}
                  <ChevronRight size={22} className="shrink-0 text-muted" />
                </Link>
              ) : (
                showTitle
              )}
            </h1>
            {isMp4Fallback && (
              <p className="mt-1.5 text-[13px] text-muted">Backup mirror: single quality, no subtitle tracks.</p>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div role="group" aria-label="Audio" className="flex rounded-lg bg-ink-800 p-1">
              {(["sub", "dub"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudio(a)}
                  aria-pressed={audio === a}
                  className={`min-h-9 rounded-md px-4 text-[13.5px] font-semibold transition-colors ${
                    audio === a ? "bg-white text-black" : "text-white/65 hover:text-white"
                  }`}
                >
                  {a === "sub" ? "Subbed" : "Dubbed"}
                </button>
              ))}
            </div>
            {(data?.providers?.length ?? 0) > 1 && (
              <select
                value={provider ?? ""}
                onChange={(e) => setProvider(e.target.value || null)}
                aria-label="Server"
                className="nb-input !min-h-11 !w-auto !py-0 text-[14px]"
              >
                <option value="">Auto server</option>
                {(data?.providers ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {PROVIDER_LABELS[p.id] ?? p.id}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={retry}
              disabled={stream.isFetching}
              aria-label="Reload stream"
              title="Reload stream"
              className="grid h-11 w-11 place-items-center rounded-lg bg-ink-800 text-white/75 transition-colors hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={17} className={stream.isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {!shelf.data?.isMovie && (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
            {hasPrev ? (
              <Link href={epHref(currentEp - 1)} prefetch={false} className="aa-cta-ghost sm:px-6">
                <SkipBack size={17} /> Episode {currentEp - 1}
              </Link>
            ) : (
              <span className="aa-cta-ghost pointer-events-none opacity-35 sm:px-6">
                <SkipBack size={17} /> First episode
              </span>
            )}
            {hasNext ? (
              <Link href={epHref(currentEp + 1)} prefetch={false} className="aa-cta sm:px-6">
                Episode {currentEp + 1} <SkipForward size={17} />
              </Link>
            ) : (
              <span className="aa-cta-ghost pointer-events-none opacity-35 sm:px-6">
                Latest episode <SkipForward size={17} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* episodes */}
      {effMal != null && (
        <aside className="min-w-0 xl:sticky xl:top-[calc(var(--header-h)+24px)] xl:max-h-[calc(100dvh-var(--header-h)-48px)] xl:overflow-y-auto xl:rounded-xl xl:bg-ink-900 xl:p-5 no-scrollbar">
          <h2 className="aa-section-title mb-4">Episodes</h2>
          {anilistId != null && (
            <div className="mb-4">
              <SeasonSelect id={anilistId} />
            </div>
          )}
          {shelf.isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-lg" />
              ))}
            </div>
          ) : shelf.isError ? (
            <p className="py-4 text-[14px] text-muted">The episode list didn&apos;t load. Use the buttons under the player.</p>
          ) : (
            <EpisodeList
              malId={effMal}
              animeTitle={showTitle}
              totalEpisodes={totalEpisodes}
              isMovie={shelf.data?.isMovie}
              nextAiring={anime?.nextAiringEpisode}
              resumeEpisode={currentEp}
              compact
            />
          )}
        </aside>
      )}
    </div>
  );
}

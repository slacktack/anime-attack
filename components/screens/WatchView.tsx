"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Server,
  Volume2,
  VolumeX,
} from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";

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
  const [buffering, setBuffering] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [showResumed, setShowResumed] = useState(false);

  const stream = useQuery({
    queryKey: ["stream", slug, malId, episode, audio, provider, refreshTick],
    queryFn: async (): Promise<SourceResponse> => {
      const params = new URLSearchParams({ slug, audio });
      if (malId) params.set("mal", String(malId));
      if (episode) params.set("ep", String(episode));
      if (provider) params.set("provider", provider);
      if (refreshTick > 0) params.set("refresh", "1");
      const res = await fetch(`/api/anime/source?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as SourceResponse & { message?: string };
      if (!res.ok) throw new Error(json.message || `Source request failed (${res.status})`);
      return json;
    },
    retry: 1,
    retryDelay: 600,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const data = stream.data;
  const showTitle = titleFromSlug(slug);
  const epNumber = data?.episode ?? episode;

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
        window.setTimeout(() => setShowResumed(false), 5000);
      } else {
        setStartAt(0);
        setResumed(false);
      }
    } catch {
      setStartAt(0);
    }
  }, [progressKey]);

  useEffect(() => {
    setFullProxy(false);
    setHardError(false);
  }, [audio, provider, refreshTick]);

  const src = useMemo(() => {
    if (!data?.source) return null;
    return proxiedMedia(data.source, fullProxy ? "full" : "smart");
  }, [data?.source, fullProxy]);

  const tracks = useMemo(
    () =>
      (data?.tracks ?? []).map((track) => ({
        ...track,
        file: proxiedMedia(track.file),
      })),
    [data?.tracks],
  );

  const handleFatal = useCallback(() => {
    if (!fullProxy) {
      setFullProxy(true);
      return;
    }
    const available = (data?.providers ?? []).map((p) => p.id);
    const currentIndex = data?.provider ? available.indexOf(data.provider) : -1;
    const next = available.slice(currentIndex + 1).find((id) => id !== data?.provider);
    if (next) {
      setProvider(next);
      setFullProxy(false);
      return;
    }
    setHardError(true);
  }, [fullProxy, data]);

  const handleProgress = useCallback(
    (time: number, duration: number) => {
      if (!progressKey) return;
      try {
        if (duration > 0 && time / duration > 0.97) {
          window.localStorage.removeItem(progressKey);
        } else {
          window.localStorage.setItem(progressKey, String(Math.floor(time)));
        }
      } catch {
        /* storage unavailable */
      }
    },
    [progressKey],
  );

  const retry = () => {
    setHardError(false);
    setFullProxy(false);
    setRefreshTick((tick) => tick + 1);
  };

  const isLoading = stream.isLoading || (stream.isFetching && !data);
  const status = stream.isError ? "error" : (data?.status ?? null);
  const dubMissing = status === "missing" && audio === "dub";
  const missing = status === "missing" && audio === "sub";
  const countdown = status === "countdown";
  const playable = status === "ok" && !!src && !hardError;
  const errorMessage =
    stream.error instanceof Error
      ? stream.error.message
      : data?.message ?? "This episode is not available right now.";

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="relative -mx-4 sm:mx-0 sm:overflow-hidden sm:rounded-2xl">
        <div className="relative bg-black">
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
              onReady={() => setBuffering(false)}
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
            />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 px-6 text-center">
              {isLoading || stream.isFetching ? (
                <>
                  <Loader2 size={28} className="animate-spin text-accent-purple" />
                  <p className="text-sm font-semibold text-white/60">Finding the best source…</p>
                </>
              ) : dubMissing ? (
                <>
                  <VolumeX size={30} className="text-accent-gold" />
                  <p className="text-sm font-semibold">Dub isn&apos;t out for this one yet</p>
                  <button type="button" onClick={() => setAudio("sub")} className="nb-btn nb-btn-accent">
                    <Play size={14} fill="currentColor" /> Watch in sub
                  </button>
                </>
              ) : countdown ? (
                <>
                  <Play size={30} className="text-accent-purple" />
                  <p className="text-sm font-semibold">This episode hasn&apos;t aired yet</p>
                  <p className="text-xs text-white/50">{data?.message ?? "Check back soon."}</p>
                </>
              ) : missing ? (
                <>
                  <AlertTriangle size={30} className="text-accent-crimson" />
                  <p className="text-sm font-semibold">Episode not found at the source</p>
                  <p className="max-w-sm text-xs text-white/50">{data?.message}</p>
                  <button type="button" onClick={retry} className="nb-btn">
                    <RefreshCw size={14} /> Try again
                  </button>
                </>
              ) : (
                <>
                  <AlertTriangle size={30} className="text-accent-crimson" />
                  <p className="text-sm font-semibold">Couldn&apos;t start the stream</p>
                  <p className="max-w-sm text-xs text-white/50">{errorMessage}</p>
                  <button type="button" onClick={retry} className="nb-btn nb-btn-accent">
                    <RefreshCw size={14} /> Retry
                  </button>
                </>
              )}
            </div>
          )}

          {showResumed && resumed && (
            <div className="pointer-events-none absolute bottom-16 left-3 z-40 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
              <Play size={10} fill="currentColor" /> Resumed {formatTime(startAt)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 sm:px-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {epNumber ? <span className="nb-tag">EP {epNumber}</span> : null}
              <span className="nb-tag border-violet-400/25 bg-violet-400/10 text-violet-200">
                {audio.toUpperCase()}
              </span>
              {data?.provider && (
                <span className="nb-tag">
                  <Server size={10} /> {PROVIDER_LABELS[data.provider] ?? data.provider}
                </span>
              )}
            </div>
            <h1 className="nb-heading mt-2 text-xl leading-tight sm:text-3xl">{showTitle}</h1>
          </div>
          <button
            type="button"
            onClick={retry}
            disabled={stream.isFetching}
            aria-label="Refresh stream"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] disabled:opacity-40"
          >
            <RefreshCw size={17} className={stream.isFetching ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAudio("sub")}
            aria-pressed={audio === "sub"}
            className={`nb-btn min-h-12 justify-center ${audio === "sub" ? "nb-btn-accent" : ""}`}
          >
            <Volume2 size={16} /> SUB
          </button>
          <button
            type="button"
            onClick={() => setAudio("dub")}
            aria-pressed={audio === "dub"}
            className={`nb-btn min-h-12 justify-center ${audio === "dub" ? "nb-btn-accent" : ""}`}
          >
            <Volume2 size={16} /> DUB
          </button>
        </div>

        {(data?.providers?.length ?? 0) > 1 && (
          <div className="nb-card p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
              <Server size={12} /> Servers
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              <button
                type="button"
                onClick={() => setProvider(null)}
                aria-pressed={provider === null}
                className={`nb-tag min-h-9 shrink-0 cursor-pointer px-3 ${
                  provider === null ? "border-white/25 bg-white/15 text-white" : "hover:bg-white/[0.08]"
                }`}
              >
                Auto
              </button>
              {(data?.providers ?? []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.tip}
                  onClick={() => setProvider(item.id)}
                  aria-pressed={provider === item.id}
                  className={`nb-tag min-h-9 shrink-0 cursor-pointer px-3 ${
                    provider === item.id
                      ? "border-white/25 bg-white/15 text-white"
                      : "hover:bg-white/[0.08]"
                  }`}
                >
                  {provider === item.id && <Check size={11} />}
                  {PROVIDER_LABELS[item.id] ?? item.id}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/45">
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>
            Tap the player for controls. Quality, speed, subtitles, picture-in-picture and fullscreen
            live in the bottom bar. Progress is saved automatically.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/" className="nb-btn">
            Home
          </Link>
          <Link href={`/search?q=${encodeURIComponent(showTitle)}`} className="nb-btn">
            Find episodes
          </Link>
        </div>
      </div>

      {hardError && (
        <div className="mx-4 nb-card p-4 sm:mx-0">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-crimson" />
            <div>
              <p className="text-sm font-semibold">All servers stumbled on this one</p>
              <p className="mt-1 text-xs text-white/50">
                The source is probably having a moment. Retry, or pick another server.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

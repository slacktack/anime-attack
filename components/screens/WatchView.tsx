"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useMemo } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { extractVideoUrl } from "@/lib/anime/aniwatch";

function formatSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const DEFAULT_QUALITY = "__default__";

function proxied(url: string): string {
  return `/api/proxy/media?url=${encodeURIComponent(url)}`;
}

export function WatchView({ slug }: { slug: string }) {
  const episodeTitle = formatSlug(slug);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["watch", "video", slug],
    queryFn: () => extractVideoUrl(slug),
    staleTime: 1000 * 60 * 10,
    retry: 2,
    retryDelay: 2000,
  });

  const [selectedQuality, setSelectedQuality] =
    useState<string>(DEFAULT_QUALITY);
  const [videoError, setVideoError] = useState(false);

  const activeUrl = useMemo(() => {
    if (!data) return null;
    if (selectedQuality !== DEFAULT_QUALITY) {
      return (
        data.qualities.find((q) => q.label === selectedQuality)?.url ??
        data.videoUrl
      );
    }
    return data.videoUrl;
  }, [data, selectedQuality]);

  const src = activeUrl ? proxied(activeUrl) : null;
  const poster = data?.thumbnail ? proxied(data.thumbnail) : undefined;

  const handleRefresh = () => {
    setVideoError(false);
    void refetch();
  };

  return (
    <div className="flex flex-col gap-4 pb-8 sm:gap-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="nb-btn" aria-label="Back to home">
          <ArrowLeft size={16} color="currentColor" />
          Back
        </Link>
        <span className="nb-tag">WATCH</span>
      </div>

      <h1 className="nb-heading nb-heading-xl font-black leading-tight">
        {episodeTitle}
      </h1>

      {isLoading && <WatchSkeleton />}

      {isError && (
        <div className="nb-card bg-ink-800 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={20}
              color="currentColor"
              className="shrink-0 text-accent-crimson"
            />
            <div className="flex flex-col gap-3">
              <p className="nb-heading nb-heading-md">
                Couldn&apos;t fetch video
              </p>
              <p className="text-sm text-white/60">
                {error instanceof Error
                  ? error.message
                  : "The video source is unavailable."}
              </p>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isFetching}
                className="nb-btn w-fit disabled:opacity-50"
              >
                <RefreshCw size={14} color="currentColor" />
                {isFetching ? "Retrying…" : "Try again"}
              </button>
            </div>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="nb-card overflow-hidden bg-ink-800 p-2 sm:p-3">
            <video
              key={src}
              src={src ?? undefined}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              className="nb-border-thick block aspect-video w-full rounded-xl bg-ink-900 object-contain"
              onError={() => setVideoError(true)}
              onPlaying={() => setVideoError(false)}
            />
          </div>

          {videoError && (
            <div className="nb-card bg-ink-800 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    size={16}
                    color="currentColor"
                    className="shrink-0 text-accent-gold"
                  />
                  <p className="text-sm font-semibold">
                    Playback issue — try refreshing
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isFetching}
                  className="nb-btn shrink-0 disabled:opacity-50"
                >
                  <RefreshCw size={14} color="currentColor" />
                  {isFetching ? "Refreshing…" : "Refresh"}
                </button>
              </div>
            </div>
          )}

          {data.qualities.length > 0 && (
            <div className="nb-card bg-ink-800 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="nb-heading nb-heading-sm shrink-0">
                  Quality
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedQuality(DEFAULT_QUALITY);
                      setVideoError(false);
                    }}
                    aria-pressed={selectedQuality === DEFAULT_QUALITY}
                    className={
                      "nb-tag cursor-pointer transition-colors " +
                      (selectedQuality === DEFAULT_QUALITY
                        ? "bg-foreground text-ink-solid"
                        : "hover:bg-ink-700")
                    }
                  >
                    Auto
                  </button>
                  {data.qualities.map((q) => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => {
                        setSelectedQuality(q.label);
                        setVideoError(false);
                      }}
                      aria-pressed={selectedQuality === q.label}
                      className={
                        "nb-tag cursor-pointer transition-colors " +
                        (selectedQuality === q.label
                          ? "bg-foreground text-ink-solid"
                          : "hover:bg-ink-700")
                      }
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {process.env.NODE_ENV === "development" && (
            <details className="nb-card bg-ink-800 p-4">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wider text-white/40">
                Debug
              </summary>
              <div className="mt-2 space-y-1 font-mono text-[10px] text-white/50">
                <p>Proxy video: {src?.slice(0, 80)}…</p>
                <p>
                  Qualities:{" "}
                  {data.qualities.map((q) => q.label).join(", ") || "none"}
                </p>
                <p>Thumbnail: {poster ?? "none"}</p>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function WatchSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="nb-border-thick aspect-video w-full animate-pulse rounded-xl bg-ink-800" />
      <div className="nb-card flex items-center gap-3 bg-ink-800 p-4">
        <div className="h-5 w-16 animate-pulse rounded bg-ink-700" />
        <div className="flex gap-2">
          <div className="h-6 w-12 animate-pulse rounded bg-ink-700" />
          <div className="h-6 w-12 animate-pulse rounded bg-ink-700" />
          <div className="h-6 w-12 animate-pulse rounded bg-ink-700" />
        </div>
      </div>
    </div>
  );
}

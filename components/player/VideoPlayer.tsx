"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Hls from "hls.js";
import type { ErrorData, Level, ManifestParsedData } from "hls.js";
import {
  Check,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Subtitles,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";

export type PlayerLevel = {
  index: number;
  height: number;
  width: number;
  bitrate: number;
};

type PlayerTrack = {
  file: string;
  label: string;
  kind: string;
  default?: boolean;
};

type Props = {
  src: string;
  poster?: string;
  kind: "hls" | "mp4";
  tracks: PlayerTrack[];
  startAt?: number;
  title?: string;
  onFatal: () => void;
  onProgress?: (time: number, duration: number) => void;
  onReady?: () => void;
  onWaiting?: () => void;
  onPlaying?: () => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function bitrateLabel(value: number): string {
  if (!value) return "";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} Mbps`;
  return `${Math.round(value / 1000)} kbps`;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function VideoPlayer({
  src,
  poster,
  kind,
  tracks,
  startAt = 0,
  title,
  onFatal,
  onProgress,
  onReady,
  onWaiting,
  onPlaying,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const levelsRef = useRef<PlayerLevel[]>([]);
  const hideTimer = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const resumed = useRef(false);
  const menuRef = useRef<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<PlayerLevel[]>([]);
  const [activeHeight, setActiveHeight] = useState(-1);
  const [effectiveHeight, setEffectiveHeight] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [trackIndex, setTrackIndex] = useState(-1);
  const [menu, setMenu] = useState<"quality" | "speed" | "subs" | null>(null);
  const [visible, setVisible] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const onFatalRef = useRef(onFatal);
  const onProgressRef = useRef(onProgress);
  const onReadyRef = useRef(onReady);
  const onWaitingRef = useRef(onWaiting);
  const onPlayingRef = useRef(onPlaying);
  onFatalRef.current = onFatal;
  onProgressRef.current = onProgress;
  onReadyRef.current = onReady;
  onWaitingRef.current = onWaiting;
  onPlayingRef.current = onPlaying;
  menuRef.current = menu;

  const showControls = useCallback(() => {
    setVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused && !menuRef.current) setVisible(false);
    }, 2800);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play().catch(() => {});
    else video.pause();
    showControls();
  }, [showControls]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + delta));
      showControls();
    },
    [showControls],
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    showControls();
  }, [showControls]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!container || !video) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else {
        video.webkitEnterFullscreen?.();
      }
    } catch {
      video.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      /* unsupported */
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let cancelled = false;
    let hls: Hls | null = null;
    let networkRetries = 0;
    let mediaRetries = 0;

    resumed.current = false;
    levelsRef.current = [];
    setLevels([]);
    setActiveHeight(-1);
    setEffectiveHeight(0);
    setBuffering(true);

    const setup = async () => {
      try {
        const mod = await import("hls.js");
        const HlsLib = mod.default;
        if (cancelled) return;

        const isHls = kind === "hls" || /\.m3u8/i.test(src);

        if (isHls && HlsLib.isSupported()) {
          hls = new HlsLib({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 45,
            maxMaxBufferLength: 90,
            maxBufferSize: 80 * 1024 * 1024,
            startLevel: -1,
            fragLoadingMaxRetry: 4,
            manifestLoadingMaxRetry: 3,
            levelLoadingMaxRetry: 3,
          });
          hlsRef.current = hls;

          hls.on(HlsLib.Events.MANIFEST_PARSED, (_event: unknown, data: ManifestParsedData) => {
            const byHeight = new Map<number, PlayerLevel>();
            data.levels.forEach((level: Level, index: number) => {
              if (!level.height) return;
              const existing = byHeight.get(level.height);
              if (!existing || existing.bitrate < level.bitrate) {
                byHeight.set(level.height, {
                  index,
                  height: level.height,
                  width: level.width,
                  bitrate: level.bitrate,
                });
              }
            });
            const parsed = [...byHeight.values()].sort((a, b) => b.height - a.height);
            levelsRef.current = parsed;
            setLevels(parsed);
            onReadyRef.current?.();
            setBuffering(false);
          });

          hls.on(HlsLib.Events.LEVEL_SWITCHED, (_event: unknown, data: { level: number }) => {
            const found = levelsRef.current.find((item) => item.index === data.level);
            if (found) setEffectiveHeight(found.height);
          });

          hls.on(HlsLib.Events.ERROR, (_event: unknown, data: ErrorData) => {
            if (!data.fatal) return;
            if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
              networkRetries += 1;
              window.setTimeout(() => {
                if (!cancelled) hls?.startLoad();
              }, 800 * networkRetries);
              return;
            }
            if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR && mediaRetries < 2) {
              mediaRetries += 1;
              hls?.recoverMediaError();
              return;
            }
            onFatalRef.current();
          });

          hls.loadSource(src);
          hls.attachMedia(video);
        } else {
          video.src = src;
        }
      } catch {
        if (!cancelled) onFatalRef.current();
      }
    };

    void setup();

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
      hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, kind]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (activeHeight < 0) {
      hls.currentLevel = -1;
      return;
    }
    const match = levelsRef.current.find((item) => item.height === activeHeight);
    hls.currentLevel = match ? match.index : -1;
  }, [activeHeight]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      const list = video.textTracks;
      for (let i = 0; i < list.length; i += 1) {
        list[i].mode = i === trackIndex ? "showing" : "disabled";
      }
    };
    apply();
    const timer = window.setTimeout(apply, 400);
    return () => window.clearTimeout(timer);
  }, [trackIndex, tracks, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => {
      try {
        setBuffered(video.buffered.length ? video.buffered.end(video.buffered.length - 1) : 0);
      } catch {
        setBuffered(0);
      }
    };
    video.addEventListener("progress", update);
    video.addEventListener("timeupdate", update);
    return () => {
      video.removeEventListener("progress", update);
      video.removeEventListener("timeupdate", update);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /input|textarea|select/i.test(target.tagName)) return;
      if (event.key === " " || event.key.toLowerCase() === "k") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowRight") {
        seekBy(10);
      } else if (event.key === "ArrowLeft") {
        seekBy(-10);
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      } else if (event.key === "Escape") {
        setMenu(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [seekBy, toggleFullscreen, toggleMute, togglePlay]);

  useEffect(() => {
    if (menu) setVisible(true);
    else showControls();
  }, [menu, showControls]);

  const progress = duration ? Math.min(100, (current / duration) * 100) : 0;
  const bufferPercent = duration ? Math.min(100, (buffered / duration) * 100) : 0;

  const qualityLabel = useMemo(() => {
    if (activeHeight < 0) {
      return effectiveHeight ? `Auto · ${effectiveHeight}p` : "Auto";
    }
    return `${activeHeight}p`;
  }, [activeHeight, effectiveHeight]);

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden bg-black sm:rounded-2xl"
      onPointerMove={showControls}
      onPointerLeave={() => {
        if (playing && !menu) setVisible(false);
      }}
    >
      <video
        ref={videoRef}
        poster={poster}
        playsInline
        preload="metadata"
        className="h-full w-full object-contain"
        onClick={togglePlay}
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          setDuration(video.duration || 0);
          if (!resumed.current && startAt > 5 && startAt < video.duration - 10) {
            video.currentTime = startAt;
          }
          resumed.current = true;
          onReadyRef.current?.();
        }}
        onPlay={() => {
          setPlaying(true);
          setBuffering(false);
          onPlayingRef.current?.();
          showControls();
        }}
        onPause={() => {
          setPlaying(false);
          setVisible(true);
        }}
        onWaiting={() => {
          setBuffering(true);
          onWaitingRef.current?.();
        }}
        onPlaying={() => {
          setBuffering(false);
          onPlayingRef.current?.();
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setCurrent(video.currentTime);
          const now = Date.now();
          if (video.currentTime > 0 && now - lastSaved.current > 4000) {
            lastSaved.current = now;
            onProgressRef.current?.(video.currentTime, video.duration || 0);
          }
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onVolumeChange={(event) => {
          setVolume(event.currentTarget.volume);
          setMuted(event.currentTarget.muted);
        }}
        onError={() => onFatalRef.current()}
      >
        {tracks.map((track, index) => (
          <track
            key={`${track.file}-${index}`}
            kind="subtitles"
            label={track.label || "Subtitles"}
            src={track.file}
            default={false}
          />
        ))}
      </video>

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-20 grid place-items-center bg-gradient-to-t from-black/55 via-black/10 to-black/25"
        >
          <span className="grid h-20 w-20 place-items-center rounded-full border border-white/20 bg-black/45 text-white shadow-[0_20px_60px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md transition-transform active:scale-95">
            <Play size={30} fill="currentColor" className="ml-1" />
          </span>
        </button>
      )}

      {buffering && playing && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/85 backdrop-blur">
            <Loader2 size={13} className="animate-spin" /> Buffering
          </span>
        </div>
      )}

      <div
        className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-200 ${
          visible || menu ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 to-transparent px-3 pb-8 pt-3">
          <p className="line-clamp-1 min-w-0 text-xs font-semibold text-white/85">{title}</p>
          <span className="shrink-0 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
            {qualityLabel}
          </span>
        </div>

        <div className="relative bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] pt-10">
          {menu && (
            <div className="absolute bottom-[calc(100%-0.5rem)] right-2 z-40 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]/95 p-2 shadow-2xl backdrop-blur-xl">
              <p className="px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">
                {menu === "quality" ? "Video quality" : menu === "speed" ? "Playback speed" : "Subtitles"}
              </p>
              {menu === "quality" && (
                <div className="max-h-56 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveHeight(-1);
                      setMenu(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-semibold hover:bg-white/10"
                  >
                    <span>Auto</span>
                    {activeHeight < 0 && <Check size={15} />}
                  </button>
                  {levels.map((item) => (
                    <button
                      key={item.height}
                      type="button"
                      onClick={() => {
                        setActiveHeight(item.height);
                        setMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold hover:bg-white/10"
                    >
                      <span className="flex flex-col">
                        <span>{item.height}p</span>
                        <span className="text-[10px] font-medium text-white/35">
                          {bitrateLabel(item.bitrate)}
                        </span>
                      </span>
                      {activeHeight === item.height && <Check size={15} />}
                    </button>
                  ))}
                  {levels.length === 0 && (
                    <p className="px-2.5 py-3 text-xs text-white/40">Single quality source</p>
                  )}
                </div>
              )}
              {menu === "speed" && (
                <div>
                  {SPEEDS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setSpeed(item);
                        if (videoRef.current) videoRef.current.playbackRate = item;
                        setMenu(null);
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-semibold hover:bg-white/10"
                    >
                      <span>{item === 1 ? "Normal" : `${item}×`}</span>
                      {speed === item && <Check size={15} />}
                    </button>
                  ))}
                </div>
              )}
              {menu === "subs" && (
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setTrackIndex(-1);
                      setMenu(null);
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm font-semibold hover:bg-white/10"
                  >
                    <span>Off</span>
                    {trackIndex < 0 && <Check size={15} />}
                  </button>
                  {tracks.map((track, index) => (
                    <button
                      key={`${track.file}-${index}`}
                      type="button"
                      onClick={() => {
                        setTrackIndex(index);
                        setMenu(null);
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold hover:bg-white/10"
                    >
                      <span className="line-clamp-1">{track.label || `Track ${index + 1}`}</span>
                      {trackIndex === index && <Check size={15} />}
                    </button>
                  ))}
                  {tracks.length === 0 && (
                    <p className="px-2.5 py-3 text-xs text-white/40">No subtitles on this source</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="relative mb-1 flex h-5 items-center">
            <div className="absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/20">
              <div className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${bufferPercent}%` }} />
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-sky-400"
                style={{ width: `${progress}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(current, duration || 0)}
              onChange={(event) => {
                const video = videoRef.current;
                if (!video) return;
                const next = Number(event.target.value);
                video.currentTime = next;
                setCurrent(next);
              }}
              aria-label="Seek"
              className="aa-range relative z-10 h-5 w-full"
              style={{ background: "transparent" }}
            />
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="grid h-10 w-10 place-items-center rounded-xl text-white/90 transition hover:bg-white/10"
            >
              {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button
              type="button"
              onClick={() => seekBy(-10)}
              aria-label="Back 10 seconds"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/75 transition hover:bg-white/10"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={() => seekBy(10)}
              aria-label="Forward 10 seconds"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/75 transition hover:bg-white/10"
            >
              <RotateCw size={17} />
            </button>

            <span className="ml-1 whitespace-nowrap text-[11px] font-semibold tabular-nums text-white/70">
              {formatTime(current)} <span className="text-white/30">/</span> {formatTime(duration)}
            </span>

            <div className="flex-1" />

            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="grid h-10 w-10 place-items-center rounded-xl text-white/75 transition hover:bg-white/10"
              >
                {muted || volume === 0 ? (
                  <VolumeX size={18} />
                ) : volume < 0.5 ? (
                  <Volume1 size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(event) => {
                  const video = videoRef.current;
                  if (!video) return;
                  const next = Number(event.target.value);
                  video.volume = next;
                  video.muted = next === 0;
                }}
                aria-label="Volume"
                className="aa-range hidden h-5 w-20 md:block"
                style={{ background: "transparent" }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const next = menu === "quality" ? null : "quality";
                setMenu(next);
                if (next) setVisible(true);
              }}
              className="flex h-10 items-center gap-1.5 rounded-xl px-2 text-[11px] font-bold uppercase tracking-wide text-white/75 transition hover:bg-white/10"
              aria-label="Video quality"
            >
              <Settings2 size={17} />
              <span className="hidden sm:inline">{activeHeight < 0 ? "Auto" : `${activeHeight}p`}</span>
            </button>

            <button
              type="button"
              onClick={() => setMenu(menu === "subs" ? null : "subs")}
              aria-label="Subtitles"
              className={`grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/10 ${
                trackIndex >= 0 ? "text-sky-300" : "text-white/75"
              }`}
            >
              <Subtitles size={18} />
            </button>

            <button
              type="button"
              onClick={() => setMenu(menu === "speed" ? null : "speed")}
              aria-label="Playback speed"
              className="hidden h-10 w-10 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 sm:grid"
            >
              <Gauge size={18} />
            </button>

            <button
              type="button"
              onClick={() => void togglePip()}
              aria-label="Picture in picture"
              className="hidden h-10 w-10 place-items-center rounded-xl text-white/75 transition hover:bg-white/10 md:grid"
            >
              <PictureInPicture2 size={18} />
            </button>

            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label="Fullscreen"
              className="grid h-10 w-10 place-items-center rounded-xl text-white/85 transition hover:bg-white/10"
            >
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

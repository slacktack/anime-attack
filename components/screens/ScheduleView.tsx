"use client";
import { useQuery } from "@tanstack/react-query";
import { getSchedule } from "@/lib/anime/anilist-extra";
import { Reveal } from "@/components/ui/Reveal";

function formatCountdown(airingAt: number): string {
  const diffMs = airingAt * 1000 - Date.now();
  if (diffMs <= 0) return "airing now";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

export function ScheduleView() {
  const { data, isLoading } = useQuery({
    queryKey: ["schedule"],
    queryFn: () => getSchedule(),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Airing Schedule</h1>
      <p className="mt-1 text-sm text-white/40">What&apos;s next</p>

      {isLoading && <p className="mt-6 text-sm text-white/40">Loading…</p>}

      {!isLoading && (!data || data.length === 0) && (
        <p className="mt-6 text-sm text-white/40">No upcoming episodes found.</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {data?.map((entry) => (
          <Reveal key={entry.id}>
            <div className="flex items-center gap-3 rounded-2xl bg-ink-800 p-3">
              <img
                src={entry.cover}
                alt={entry.title}
                loading="lazy"
                className="h-24 w-16 flex-shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-semibold">{entry.title}</h2>
                <p className="mt-1 text-sm text-white/50">Episode {entry.episode}</p>
                <p className="mt-1 text-sm font-medium text-accent-gold">
                  {formatCountdown(entry.airingAt)}
                </p>
                <p className="mt-1 break-words text-xs text-white/30">
                  {new Date(entry.airingAt * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

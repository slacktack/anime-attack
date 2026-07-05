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
      <h1 className="nb-heading nb-heading-xl">Schedule</h1>
      <div className="nb-section-header mt-1">Airing Schedule</div>

      {isLoading && <p className="mt-6 font-bold text-white/60">Loading…</p>}

      {!isLoading && (!data || data.length === 0) && (
        <p className="mt-6 font-bold text-white/60">No upcoming episodes found.</p>
      )}

      <div className="nb-card mt-6 flex flex-col gap-3 bg-ink-800 p-4">
        {data?.map((entry) => (
          <Reveal key={entry.id}>
            <div className="nb-card-sm flex items-center gap-3 bg-ink-700 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.cover}
                alt={entry.title}
                loading="lazy"
                className="h-24 w-16 flex-shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 font-bold">{entry.title}</h2>
                <p className="nb-tag mt-1">Episode {entry.episode}</p>
                <p className="mt-1 text-sm font-bold text-accent-gold">
                  {formatCountdown(entry.airingAt)}
                </p>
                <p className="mt-1 break-words text-xs font-medium text-white/60">
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

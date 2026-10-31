"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock } from "lucide-react";
import { fetchSchedule } from "@/lib/client/api";

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
  const { data, isLoading } = useQuery({ queryKey: ["schedule"], queryFn: fetchSchedule });

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="flex items-center gap-2 font-display text-[26px] font-bold tracking-tight">
          <CalendarDays size={21} className="text-accent-blue" />
          Schedule
        </h1>
        <p className="mt-0.5 text-[12.5px] font-semibold text-white/40">
          Upcoming episodes, soonest first.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-[86px] w-full rounded-2xl" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="flex flex-col gap-2">
          {data.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 rounded-2xl border border-nb-border bg-white/[0.04] p-2.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.cover}
                alt={entry.title}
                loading="lazy"
                className="h-[68px] w-[48px] shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-display text-[12.5px] font-bold leading-tight">
                  {entry.title}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] font-semibold">
                  <span className="rounded-full border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-white/60">
                    EP {entry.episode}
                  </span>
                  <span className="flex items-center gap-0.5 text-accent-gold">
                    <Clock size={10} /> {formatCountdown(entry.airingAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-white/30">
                  {new Date(entry.airingAt * 1000).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="nb-card p-6 text-center">
          <p className="font-display text-[14px] font-bold">No upcoming episodes</p>
          <p className="mt-1 text-[12px] text-white/45">Check back a little later.</p>
          <Link href="/browse" className="nb-btn nb-btn-accent mx-auto mt-3">
            Browse instead
          </Link>
        </div>
      )}
    </div>
  );
}

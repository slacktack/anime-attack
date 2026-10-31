"use client";
import { PageHeader } from "@/components/ui/PageHeader";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

export function ScheduleView() {
  const { data, isLoading } = useQuery({ queryKey: ["schedule"], queryFn: fetchSchedule });

  const groups = new Map<string, NonNullable<typeof data>>();
  for (const entry of data ?? []) {
    const label = dayLabel(new Date(entry.airingAt * 1000));
    groups.set(label, [...(groups.get(label) ?? []), entry]);
  }

  return (
    <div>
      <PageHeader title="Schedule" subtitle="Episodes airing next, in your local time." />

      {isLoading ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-[84px] w-full" />
          ))}
        </div>
      ) : groups.size > 0 ? (
        <div className="flex flex-col gap-10">
          {[...groups.entries()].map(([label, entries]) => (
            <section key={label}>
              <h2 className="aa-section-title mb-3">
                {label}
                <span className="text-[13px] font-medium tracking-normal text-muted">{entries.length}</span>
              </h2>
              <div className="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
                {entries.map((entry) => {
                  const at = new Date(entry.airingAt * 1000);
                  return (
                    <div key={entry.id} className="flex items-center gap-4 rounded-lg bg-ink-800 p-2.5 pr-4">
                      <span className="w-14 shrink-0 text-center font-display text-[17px] font-bold tabular-nums">
                        {at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="poster-frame h-[64px] w-[45px] shrink-0 rounded-md">
                        {entry.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{entry.title}</p>
                        <p className="mt-0.5 text-[12.5px] text-muted">
                          Episode {entry.episode}
                          <span className="mx-1.5 opacity-50">/</span>
                          <span className="text-accent-gold">{formatCountdown(entry.airingAt)}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="font-display text-[20px] font-bold">Nothing scheduled right now</p>
          <p className="mt-1 text-[14px] text-muted">New airings show up here as they&apos;re announced.</p>
          <Link href="/browse" className="aa-cta mt-5">
            Browse the catalogue
          </Link>
        </div>
      )}
    </div>
  );
}

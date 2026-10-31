"use client";

import { useEffect, useState } from "react";

function format(airingAt: number): string {
  const ms = airingAt * 1000 - Date.now();
  if (ms <= 0) return "now";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

/** Live "in 3d 4h" countdown for a Unix airing timestamp. */
export function Countdown({ airingAt }: { airingAt: number }) {
  const [label, setLabel] = useState(() => format(airingAt));

  useEffect(() => {
    setLabel(format(airingAt));
    const timer = window.setInterval(() => setLabel(format(airingAt)), 30_000);
    return () => window.clearInterval(timer);
  }, [airingAt]);

  return <span className="font-bold text-sky-300">{label}</span>;
}

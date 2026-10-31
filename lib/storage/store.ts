import type { AnimeSummary } from "@/lib/anime/types";

const NS = "animecomp.v1";
const key = (k: string) => `${NS}.${k}`;

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key(k));
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function write(k: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key(k), JSON.stringify(value)); } catch { /* quota */ }
}

export function getSpoilerCeiling(animeId: number): number {
  return read<Record<string, number>>("ceiling", {})[String(animeId)] ?? 0;
}
export function setSpoilerCeiling(animeId: number, episode: number): void {
  const map = read<Record<string, number>>("ceiling", {});
  map[String(animeId)] = Math.max(0, Math.floor(episode));
  write("ceiling", map);
}

export function getFavorites(): AnimeSummary[] {
  return read<AnimeSummary[]>("favorites", []);
}
export function isFavorite(animeId: number): boolean {
  return getFavorites().some((f) => f.id === animeId);
}
export function toggleFavorite(item: AnimeSummary): boolean {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === item.id);
  if (idx >= 0) { list.splice(idx, 1); write("favorites", list); return false; }
  list.unshift(item); write("favorites", list); return true;
}

type Progress = { anime: AnimeSummary; episode: number; at: number; malId?: number | null };
export function recordProgress(item: AnimeSummary, episode: number, malId?: number | null): void {
  const list = read<Progress[]>("progress", []).filter((p) => p.anime.id !== item.id);
  list.push({ anime: item, episode, at: nowMonotonic(list), malId: malId ?? null });
  write("progress", list);
}
export function getContinueWatching(): Progress[] {
  return read<Progress[]>("progress", []).slice().sort((a, b) => b.at - a.at);
}

// Avoid Date.now() flakiness in tests: monotonic counter derived from existing entries.
function nowMonotonic(existing: Progress[]): number {
  const max = existing.reduce((m, p) => Math.max(m, p.at), 0);
  return max + 1;
}

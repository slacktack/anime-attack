// Fire-and-forget source resolve so the server's 90s cache is hot before the click.
const warmed = new Map<string, number>();

export function warmStream(opts: { mal?: number | null; ep?: number; slug?: string; audio?: "sub" | "dub" }) {
  if (typeof window === "undefined") return;
  if (!opts.mal && !opts.slug) return;
  const params = new URLSearchParams({ audio: opts.audio ?? "sub" });
  if (opts.slug) params.set("slug", opts.slug);
  if (opts.mal) params.set("mal", String(opts.mal));
  if (opts.ep) params.set("ep", String(opts.ep));
  const key = params.toString();
  const last = warmed.get(key);
  if (last && Date.now() - last < 60_000) return;
  warmed.set(key, Date.now());
  void fetch(`/api/anime/source?${key}`, { priority: "low" } as RequestInit).catch(() => {});
}

// Parses a /watch href so any watch link can warm itself on hover.
export function warmFromHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    const slug = url.pathname.split("/watch/")[1];
    if (!slug) return;
    const mal = Number(url.searchParams.get("mal")) || null;
    const ep = Number(url.searchParams.get("ep")) || undefined;
    const audio = url.searchParams.get("audio") === "dub" ? "dub" : "sub";
    warmStream({ mal, ep, slug, audio });
  } catch {
    /* ignore */
  }
}

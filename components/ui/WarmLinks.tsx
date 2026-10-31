"use client";

import { useEffect } from "react";
import { warmFromHref } from "@/lib/client/warm";

// Delegated hover/touch intent on any watch link pre-resolves its stream.
export function WarmLinks() {
  useEffect(() => {
    let timer: number | undefined;
    const target = (e: Event) => (e.target as Element | null)?.closest?.('a[href^="/watch/"]') as HTMLAnchorElement | null;
    const onOver = (e: Event) => {
      const a = target(e);
      if (!a) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => warmFromHref(a.getAttribute("href")!), 90);
    };
    const onOut = () => window.clearTimeout(timer);
    const onTouch = (e: Event) => {
      const a = target(e);
      if (a) warmFromHref(a.getAttribute("href")!);
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("touchstart", onTouch, { passive: true });
    document.addEventListener("focusin", onOver);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("touchstart", onTouch);
      document.removeEventListener("focusin", onOver);
    };
  }, []);
  return null;
}

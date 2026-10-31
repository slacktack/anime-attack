"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export function Row({
  title,
  href,
  hint,
  children,
  className = "",
}: {
  title?: string;
  href?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft < 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, children]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth - 2 * parseFloat(getComputedStyle(el).paddingLeft)), behavior: "smooth" });
  };

  return (
    <section className={`aa-row ${className}`}>
      {title && (
        <div className="aa-gutter">
          <SectionHeader title={title} href={href} hint={hint} />
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          data-side="left"
          aria-label="Scroll left"
          disabled={edges.start}
          onClick={() => page(-1)}
          className="aa-rail-arrow"
        >
          <ChevronLeft size={34} strokeWidth={2.2} />
        </button>
        <div ref={ref} onScroll={measure} className="aa-rail aa-gutter py-1">
          {children}
        </div>
        <button
          type="button"
          data-side="right"
          aria-label="Scroll right"
          disabled={edges.end}
          onClick={() => page(1)}
          className="aa-rail-arrow"
        >
          <ChevronRight size={34} strokeWidth={2.2} />
        </button>
      </div>
    </section>
  );
}

"use client";
import useEmblaCarousel from "embla-carousel-react";
import type { ReactNode } from "react";

export function Carousel({ title, children }: { title: string; children: ReactNode }) {
  const [ref] = useEmblaCarousel({ dragFree: true, align: "start" });
  return (
    <section className="mb-8">
      <h2 className="nb-section-header">{title}</h2>
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-3">{children}</div>
      </div>
    </section>
  );
}

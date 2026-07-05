"use client";
import useEmblaCarousel from "embla-carousel-react";
import type { ReactNode } from "react";

export function Carousel({ title, children }: { title: string; children: ReactNode }) {
  const [ref] = useEmblaCarousel({ dragFree: true, align: "start" });
  return (
    <section className="mb-8">
      <h2 className="mb-3 px-4 text-lg font-bold tracking-tight">{title}</h2>
      <div ref={ref} className="overflow-hidden">
        <div className="flex gap-3 px-4">{children}</div>
      </div>
    </section>
  );
}

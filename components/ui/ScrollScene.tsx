"use client";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

export function ScrollScene({
  children,
  className,
  heightVh = 180,
}: {
  children: ReactNode;
  className?: string;
  heightVh?: number;
}) {
  const reduced = useReducedMotion();
  const outerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: outerRef,
    offset: ["start start", "end end"],
  });

  const opacity = useTransform(
    scrollYProgress,
    [0, 0.8, 1],
    [1, 1, 0]
  );
  const scale = useTransform(scrollYProgress, [0, 0.2], [1.05, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  if (reduced) {
    return (
      <section className={className}>
        <div className="flex items-center justify-center">{children}</div>
      </section>
    );
  }

  return (
    <div
      ref={outerRef}
      style={{ height: `${heightVh}vh`, position: "relative" }}
    >
      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <motion.div className={className} style={{ opacity, scale, y }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

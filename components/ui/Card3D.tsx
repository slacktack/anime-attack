"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";
import type { PointerEvent, ReactNode } from "react";

export function Card3D({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0), y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 15 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 15 });

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - r.left) / r.width - 0.5);
    y.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() { x.set(0); y.set(0); }

  return (
    <motion.div
      onPointerMove={onMove} onPointerLeave={reset}
      style={reduced ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 800 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

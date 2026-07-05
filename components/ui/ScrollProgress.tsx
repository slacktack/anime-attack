"use client";
import { motion, useScroll, useSpring } from "framer-motion";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

export function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  if (reduced) {
    return null;
  }

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[60] h-1 bg-gradient-to-r from-accent-purple to-accent-blue"
      style={{ scaleX, transformOrigin: "0%" }}
    />
  );
}

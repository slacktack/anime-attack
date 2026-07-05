"use client";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

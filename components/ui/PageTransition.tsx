"use client";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";
import type { ReactNode } from "react";

export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  const reduced = useReducedMotion();
  if (reduced) return <>{children}</>;
  return (
    <motion.div
      key={path}
      initial={{ opacity: 0, y: 18, scale: 0.985, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{
        opacity: { duration: 0.35, ease: "easeOut" },
        y: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
        scale: { type: "spring", stiffness: 260, damping: 30, mass: 0.9 },
        filter: { duration: 0.22, ease: "easeOut" },
      }}
      style={{ willChange: "transform, opacity, filter" }}
    >
      {children}
    </motion.div>
  );
}

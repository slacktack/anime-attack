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
    <motion.div key={path}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

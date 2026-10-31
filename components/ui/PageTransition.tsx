"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Opacity only: a transform here would break position:fixed inside pages.
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div key={path} className="aa-in">
      {children}
    </div>
  );
}

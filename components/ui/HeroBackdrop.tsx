"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

const HeroScene = dynamic(() => import("./HeroScene"), { ssr: false });

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export function HeroBackdrop({ tint = "#7C3AED" }: { tint?: string }) {
  const reduced = useReducedMotion();
  const [enable, setEnable] = useState(false);
  useEffect(() => {
    const lowEnd = (navigator.hardwareConcurrency ?? 4) <= 2;
    setEnable(!reduced && !lowEnd && webglOk());
  }, [reduced]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: `radial-gradient(1200px 600px at 50% -10%, ${tint}55, transparent 60%)` }} />
      {enable && <div className="absolute inset-0 opacity-70"><HeroScene tint={tint} /></div>}
    </div>
  );
}

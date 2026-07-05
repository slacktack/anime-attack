"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";

const AuroraScene = dynamic(() => import("./AuroraScene"), { ssr: false });

function webglOk(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export function AuroraBackdrop({ tint = "#7C3AED" }: { tint?: string }) {
  const reduced = useReducedMotion();
  const [enable, setEnable] = useState(false);
  useEffect(() => {
    const lowEnd = (navigator.hardwareConcurrency ?? 4) <= 2;
    setEnable(!reduced && !lowEnd && webglOk());
  }, [reduced]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(1100px 550px at 20% -10%, ${tint}40, transparent 60%), linear-gradient(160deg, #3B82F633, transparent 55%), radial-gradient(900px 500px at 90% 110%, #DC262633, transparent 60%)`,
        }}
      />
      {enable && (
        <div className="absolute inset-0 opacity-60">
          <AuroraScene tint={tint} />
        </div>
      )}
      {/* Neobrutalist grain — tactile rawness over the atmosphere */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}

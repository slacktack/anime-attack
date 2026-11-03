import { useId } from "react";

export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-crimson)" />
          <stop offset="1" stopColor="var(--accent-blue)" />
        </linearGradient>
        <linearGradient id={`sh${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#bg${id})`} />
      <rect width="64" height="64" rx="16" fill={`url(#sh${id})`} />
      <path d="M32 11 L50 52 H41.5 L32 29 L22.5 52 H14 Z" fill="#fff" />
      <path d="M17 43 L49 33 L47.5 38.5 L15.5 48.5 Z" fill="#0e0e10" fillOpacity="0.45" />
      <path d="M18.5 40.5 L47 31.5 L45.8 35.5 L17.3 44.5 Z" fill="#fff" />
      <path
        className="origin-[50px_14px] transition-transform duration-500 group-hover:rotate-90 group-hover:scale-125"
        d="M50 8 l1.6 4.4 4.4 1.6 -4.4 1.6 -1.6 4.4 -1.6 -4.4 -4.4 -1.6 4.4 -1.6 z"
        fill="#fff"
      />
    </svg>
  );
}

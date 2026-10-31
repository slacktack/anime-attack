import Link from "next/link";
import { Compass, Drama, CalendarDays, Sparkles, type LucideIcon } from "lucide-react";
import { HomeCarousels } from "@/components/screens/HomeCarousels";
import { QuoteWidget } from "@/components/screens/QuoteWidget";
import { AuroraBackdrop } from "@/components/ui/AuroraBackdrop";
import { ScrollScene } from "@/components/ui/ScrollScene";
import { Parallax } from "@/components/ui/Parallax";

const QUICK_LINKS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/characters", label: "Characters", Icon: Drama },
  { href: "/schedule", label: "Schedule", Icon: CalendarDays },
];

export default function HomePage() {
  return (
    <main className="flex flex-col gap-8 pt-0">
      {/* ── Hero: Magazine Cover ── */}
      <ScrollScene heightVh={160} className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 text-center">
        <AuroraBackdrop tint="#7C3AED" />
        <Parallax speed={1.2} className="flex flex-col items-center">
          <span className="nb-tag mb-4 text-white">
            <Sparkles size={14} className="mr-1.5" aria-hidden />
            Good Evening
          </span>
          <h1 className="text-gradient text-5xl font-black tracking-tight sm:text-7xl">
            Anime Attack
          </h1>
          <p className="mt-4 max-w-sm font-bold text-base text-white/80 sm:max-w-md sm:text-lg">
            Watch anime, read manga, and track everything — no ads, no noise.
          </p>
        </Parallax>
      </ScrollScene>

      {/* ── Quick Links: Chunky Neobrutalist Buttons ── */}
      <nav className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="nb-btn shrink-0 active:scale-95"
          >
            <link.Icon size={18} aria-hidden />
            {link.label}
          </Link>
        ))}
      </nav>

      {/* ── Quote: Bordered Card Block ── */}
      <QuoteWidget />

      {/* ── Carousels: Independent Blocks ── */}
      <HomeCarousels />
    </main>
  );
}

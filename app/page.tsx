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
    <main className="pt-0">
      <ScrollScene heightVh={160} className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 text-center">
        <AuroraBackdrop tint="#7C3AED" />
        <Parallax speed={1.2} className="flex flex-col items-center">
          <p className="mb-3 flex items-center gap-1.5 text-sm text-white/50">
            Good Evening <Sparkles size={16} color="currentColor" />
          </p>
          <h1 className="text-gradient text-4xl font-black tracking-tight sm:text-6xl">
            Anime Companion
          </h1>
          <p className="mt-4 max-w-xs text-sm text-white/60 sm:max-w-md sm:text-base">
            Your cinematic guide to everything anime — track, discover, and dive in.
          </p>
        </Parallax>
      </ScrollScene>

      <nav className="no-scrollbar -mx-4 mb-6 flex gap-3 overflow-x-auto px-4">
        {QUICK_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 backdrop-blur transition active:scale-95"
          >
            <link.Icon size={18} color="currentColor" aria-hidden />
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mb-6">
        <QuoteWidget />
      </div>

      <HomeCarousels />
    </main>
  );
}

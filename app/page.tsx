import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Compass,
  Drama,
  Library,
  Search,
  type LucideIcon,
} from "lucide-react";
import { HomeHero } from "@/components/screens/HomeHero";
import { HomeCarousels } from "@/components/screens/HomeCarousels";
import { QuoteWidget } from "@/components/screens/QuoteWidget";

const TILES: { href: string; label: string; Icon: LucideIcon; tint: string }[] = [
  { href: "/search", label: "Search", Icon: Search, tint: "#a78bfa" },
  { href: "/browse", label: "Browse", Icon: Compass, tint: "#38bdf8" },
  { href: "/manga", label: "Manga", Icon: BookOpen, tint: "#fbbf24" },
  { href: "/schedule", label: "Schedule", Icon: CalendarDays, tint: "#fb7185" },
  { href: "/characters", label: "Cast", Icon: Drama, tint: "#f472b6" },
  { href: "/library", label: "Library", Icon: Library, tint: "#34d399" },
];

export default function HomePage() {
  return (
    <main className="flex flex-col gap-5 pb-6">
      <HomeHero />

      <nav aria-label="Quick actions" className="px-3">
        <div className="grid grid-cols-3 gap-2">
          {TILES.map(({ href, label, Icon, tint }) => (
            <Link
              key={href}
              href={href}
              className="aa-card aa-card-raise flex items-center gap-2 px-2.5 py-2.5"
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                style={{ background: `${tint}22`, color: tint }}
              >
                <Icon size={16} />
              </span>
              <span className="truncate text-[11.5px] font-bold text-white/75">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <HomeCarousels />

      <div className="px-3">
        <QuoteWidget />
      </div>
    </main>
  );
}

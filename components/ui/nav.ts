import {
  BookOpen,
  CalendarDays,
  Compass,
  Drama,
  Home,
  Library,
  type LucideIcon,
} from "lucide-react";

export const NAV_ITEMS: { href: string; label: string; short: string; Icon: LucideIcon }[] = [
  { href: "/", label: "Home", short: "Home", Icon: Home },
  { href: "/browse", label: "Browse", short: "Browse", Icon: Compass },
  { href: "/schedule", label: "Schedule", short: "Schedule", Icon: CalendarDays },
  { href: "/manga", label: "Manga", short: "Manga", Icon: BookOpen },
  { href: "/characters", label: "Characters", short: "Cast", Icon: Drama },
  { href: "/library", label: "My list", short: "My list", Icon: Library },
];

export function isActive(path: string, href: string): boolean {
  if (href === "/") return path === "/";
  if (href === "/characters") return path.startsWith("/character");
  return path.startsWith(href);
}

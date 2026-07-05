import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/ui/BottomNav";
import { PageTransition } from "@/components/ui/PageTransition";
import { ScrollProgress } from "@/components/ui/ScrollProgress";

export const metadata: Metadata = { title: "Anime Companion", description: "The smartest anime companion." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-white antialiased pb-24">
        <ScrollProgress />
        <Providers><PageTransition>{children}</PageTransition></Providers>
        <BottomNav />
      </body>
    </html>
  );
}

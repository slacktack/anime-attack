import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/ui/BottomNav";
import { PageTransition } from "@/components/ui/PageTransition";

export const metadata: Metadata = { title: "Anime Companion", description: "The smartest anime companion." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink-900 text-white antialiased pb-20">
        <Providers><PageTransition>{children}</PageTransition></Providers>
        <BottomNav />
      </body>
    </html>
  );
}

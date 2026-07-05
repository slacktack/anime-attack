import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/ui/BottomNav";
import { PageTransition } from "@/components/ui/PageTransition";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = { title: "Anime Companion", description: "The smartest anime companion." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-ink-900 text-white antialiased pb-24">
        <ThemeProvider>
          <ScrollProgress />
          <Providers><PageTransition>{children}</PageTransition></Providers>
          <BottomNav />
          <ThemeSwitcher />
        </ThemeProvider>
      </body>
    </html>
  );
}

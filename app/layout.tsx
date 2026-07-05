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
  weight: ["400", "500", "700"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anime Companion",
  description: "Your Neobrutalist anime command center.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-ink-solid text-white antialiased pb-28">
        <ThemeProvider>
          <ScrollProgress />
          <Providers>
            <PageTransition>{children}</PageTransition>
          </Providers>
          <BottomNav />
          <ThemeSwitcher />
        </ThemeProvider>
      </body>
    </html>
  );
}

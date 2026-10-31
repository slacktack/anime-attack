import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/ui/BottomNav";
import { PageTransition } from "@/components/ui/PageTransition";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { AppHeader } from "@/components/ui/AppHeader";
import { WarmLinks } from "@/components/ui/WarmLinks";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Anime Attack · Watch anime, read manga",
    template: "%s · Anime Attack",
  },
  description:
    "Ad-free anime streaming with sub/dub and adaptive quality, plus a full manga reader. Built for otakus.",
  applicationName: "Anime Attack",
  appleWebApp: {
    capable: true,
    title: "Anime Attack",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
    { media: "(prefers-color-scheme: light)", color: "#f4efe1" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('ac.theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'paper':'midnight';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-[100dvh] overflow-x-clip bg-ink-solid pb-[calc(5.5rem+env(safe-area-inset-bottom))] text-white antialiased lg:pb-0">
        <ThemeProvider>
          <Providers>
            <AppHeader />
            <PageTransition>{children}</PageTransition>
          </Providers>
          <BottomNav />
          <WarmLinks />
        </ThemeProvider>
      </body>
    </html>
  );
}

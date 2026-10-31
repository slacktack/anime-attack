import type { Metadata } from "next";
import { MangaBrowser } from "@/components/manga/MangaBrowser";

export const metadata: Metadata = {
  title: "Manga",
  description: "Search and read manga online with no ads or redirects.",
};

export default function MangaPage() {
  return (
    <main className="px-4 pt-3">
      <MangaBrowser />
    </main>
  );
}

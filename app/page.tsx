import { HomeCarousels } from "@/components/screens/HomeCarousels";

export default function HomePage() {
  return (
    <main className="pt-8">
      <header className="mb-6 px-4">
        <p className="text-sm text-white/50">Good Evening 👋</p>
        <h1 className="text-2xl font-black tracking-tight">Anime Companion</h1>
      </header>
      <HomeCarousels />
    </main>
  );
}

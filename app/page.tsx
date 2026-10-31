import { HomeHero } from "@/components/screens/HomeHero";
import { HomeCarousels } from "@/components/screens/HomeCarousels";
import { QuoteWidget } from "@/components/screens/QuoteWidget";

export default function HomePage() {
  return (
    <main className="flex flex-col pb-10">
      <HomeHero />
      <HomeCarousels />
      <div className="aa-gutter mt-12">
        <QuoteWidget />
      </div>
    </main>
  );
}

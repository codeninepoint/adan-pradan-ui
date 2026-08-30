import { CompareSection } from "@/components/landing/compare-section";
import { ContributorFlowSection } from "@/components/landing/contributor-flow-section";
import { CtaSection } from "@/components/landing/cta-section";
import { HeroSection } from "@/components/landing/hero-section";
import { MissionVisionSection } from "@/components/landing/mission-vision-section";
import { PrinciplesSection } from "@/components/landing/principles-section";
import { QuoteSection } from "@/components/landing/quote-section";

export default function Home() {
  return (
    <div className="flex-1 bg-background font-sans text-foreground">
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-12 sm:px-6 lg:gap-12">
        <HeroSection />
        <MissionVisionSection />
        <QuoteSection />
        <ContributorFlowSection />
        <PrinciplesSection />
        <CompareSection />
      </main>
      <CtaSection />
    </div>
  );
}

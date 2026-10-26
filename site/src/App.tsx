import { AsciiRain } from "./sections/AsciiRain";
import { SiteHeader } from "./sections/SiteHeader";
import { SiteFooter } from "./sections/SiteFooter";
import { Hero } from "./sections/Hero";
import { Pain } from "./sections/Pain";
import { Steps } from "./sections/Steps";
import { Delivery } from "./sections/Delivery";
import { Reach } from "./sections/Reach";
import { Safety } from "./sections/Safety";
import { Pricing } from "./sections/Pricing";
import { Faq } from "./sections/Faq";
import { Install } from "./sections/Install";

export function App() {
  return (
    <div className="lp-root" data-heading="display">
      <AsciiRain />
      <SiteHeader />
      <main id="top" className="relative z-10">
        <Hero />
        <Pain />
        <Steps />
        <Delivery />
        <Reach />
        <Safety />
        <Pricing />
        <Faq />
        <Install />
      </main>
      <SiteFooter />
    </div>
  );
}

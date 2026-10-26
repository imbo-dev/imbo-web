import { AsciiRain } from "./sections/AsciiRain";
import { SiteHeader } from "./sections/SiteHeader";
import { SiteFooter } from "./sections/SiteFooter";
import { NotFound } from "./sections/NotFound";
import { Privacy } from "./sections/Privacy";
import { Terms } from "./sections/Terms";

// Pages other than the landing page: same frame, header and footer, one body each.
// Each page's HTML shell names its body in <div id="root" data-page="…">.
export const PAGES = { notFound: NotFound, privacy: Privacy, terms: Terms };
export type PageName = keyof typeof PAGES;

export function SubPage({ name }: { name: PageName }) {
  const Body = PAGES[name];
  return (
    <div className="lp-root" data-heading="display">
      <AsciiRain />
      <SiteHeader base="/" />
      <main id="top" className="relative z-10">
        <Body />
      </main>
      <SiteFooter base="/" />
    </div>
  );
}

import { Island } from "../islands/Island";
import siteHeader1 from "../islands/siteHeader1.js";
import siteHeader2 from "../islands/siteHeader2.js";
import siteHeader3 from "../islands/siteHeader3.js";

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 pt-3 lg:pt-4">
    <div className="lp-container">
      <nav aria-label="Main" data-lp-nav="true" className="relative mx-auto w-full max-w-[60rem] font-['JetBrains_Mono'] text-sm text-on-surface bg-background select-none">
        {"\n"}
        <pre aria-hidden="true" data-ascii-bg="" className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre font-['JetBrains_Mono'] text-[10px] leading-[10px] text-outline opacity-30" />
        {"\n"}
        <span aria-hidden="true" data-ascii-edge="h" className="pointer-events-none absolute inset-x-0 -top-[6px] h-3 overflow-hidden whitespace-pre font-['JetBrains_Mono'] text-[12px] leading-3 text-outline opacity-60">
          ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
        </span>
        {"\n"}
        <span aria-hidden="true" data-ascii-edge="h" className="pointer-events-none absolute inset-x-0 -bottom-[6px] h-3 overflow-hidden whitespace-pre font-['JetBrains_Mono'] text-[12px] leading-3 text-outline opacity-60">
          ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
        </span>
        {"\n"}
        <span aria-hidden="true" data-ascii-edge="v" className="pointer-events-none absolute inset-y-0 -left-[4px] w-[8px] overflow-hidden whitespace-pre font-['JetBrains_Mono'] text-[12px] leading-[8px] text-center text-outline opacity-60">{"│\n│\n│\n│\n│\n│\n│\n│\n│"}</span>
        {"\n"}
        <span aria-hidden="true" data-ascii-edge="v" className="pointer-events-none absolute inset-y-0 -right-[4px] w-[8px] overflow-hidden whitespace-pre font-['JetBrains_Mono'] text-[12px] leading-[8px] text-center text-outline opacity-60">{"│\n│\n│\n│\n│\n│\n│\n│\n│"}</span>
        {"\n"}
        <span aria-hidden="true" data-corner="tl" className="pointer-events-none absolute -top-[5px] -left-[5px] z-10 w-2 h-2 bg-outline" />
        {"\n"}
        <span aria-hidden="true" data-corner="tr" className="pointer-events-none absolute -top-[5px] -right-[5px] z-10 w-2 h-2 bg-outline" />
        {"\n"}
        <span aria-hidden="true" data-corner="bl" className="pointer-events-none absolute -bottom-[5px] -left-[5px] z-10 w-2 h-2 bg-outline" />
        {"\n"}
        <span aria-hidden="true" data-corner="br" className="pointer-events-none absolute -bottom-[5px] -right-[5px] z-10 w-2 h-2 bg-outline" />
        {"\n"}
        <div aria-hidden="true" className="absolute top-0 left-[64.5%] [transform:translate(-50%,-50%)] z-[5] whitespace-nowrap flex items-center gap-1 px-1.5 py-0.5 bg-background text-xs leading-none text-on-surface-variant">
          <span className="absolute inset-0 pointer-events-none">
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible text-outline" preserveAspectRatio="none">
              <rect className="imbo-q870-ants" x="0.5" y="0.5" width="calc(100% - 1px)" height="calc(100% - 1px)" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" shapeRendering="crispEdges" />
            </svg>
          </span>
          <span data-ascii-breath="" className="relative inline-block w-[1ch] text-center text-success animate-pulse" aria-hidden="true">
            o
            <Island run={siteHeader1} />
          </span>
          <span className="relative">imbo.dev</span>
          <span className="relative text-outline">::</span>
          <span data-ascii-live="" className="relative">3 sessions live</span>
        </div>
        {"\n"}
        <div aria-hidden="true" className="absolute top-full left-[64.5%] [transform:translate(-50%,-50%)] z-[5] px-1 bg-background text-xs leading-none text-outline">
          <span className="relative inline-flex items-center gap-1 px-1.5 py-0.5 leading-none tabular-nums overflow-hidden whitespace-nowrap bg-background text-xs">
            <span aria-hidden="true" className="imbo-q877-c imbo-q877-tl border-on-surface" />
            <span aria-hidden="true" className="imbo-q877-c imbo-q877-tr border-on-surface" />
            <span aria-hidden="true" className="imbo-q877-c imbo-q877-br border-on-surface" />
            <span aria-hidden="true" className="imbo-q877-c imbo-q877-bl border-on-surface" />
            <span aria-hidden="true" className="imbo-q877-sw bg-on-surface/70" />
            <span aria-hidden="true" className="imbo-q877-sw imbo-q877-sw2 bg-on-surface/30" />
            <span aria-hidden="true" className="inline-flex text-on-surface-variant -tracking-[0.2em]">
              <span className="imbo-q877-ch">›</span>
              <span className="imbo-q877-ch">›</span>
              <span className="imbo-q877-ch">›</span>
            </span>
            <span className="imbo-q877-num text-on-surface" data-ascii-tick="">0x00</span>
            <span className="text-on-surface-variant">msg/s</span>
          </span>
        </div>
        {"\n"}
        <div className="relative flex items-center justify-between gap-4 h-14 px-4">
          {"\n"}
          <div className="flex h-full items-center gap-3">
            {"\n"}
            <a href="/" className="flex items-center h-8 gap-2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <picture>
                <img src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='-82.5%20-1040.8%202470%201123.3'%20role='img'%3e%3ctitle%3eimbo%3c/title%3e%3cpath%20d='M1468%2010Q1418.5%2010%201377.5%20-10.2Q1355.9%20-20.9%201338.5%20-35.6V0H1188V-726H1341V-454.6Q1357.7%20-467.6%201378%20-477Q1419%20-496%201468%20-496Q1537%20-496%201590.5%20-463Q1644%20-430%201674.5%20-372.8Q1705%20-315.5%201705%20-242.5Q1705%20-170%201674.5%20-113Q1644%20-56%201590.5%20-23Q1537%2010%201468%2010ZM315%200V-486H468V-450Q483.3%20-463.4%20502%20-473.2Q545%20-496%20599%20-496Q649.5%20-496%20690.2%20-473Q719.8%20-456.3%20740.6%20-430Q762.8%20-455.2%20793.2%20-471.5Q839%20-496%20896%20-496Q951.5%20-496%20995.2%20-472.5Q1039%20-449%201064.5%20-405.5Q1090%20-362%201090%20-301V0H937V-284Q937%20-320.5%20914.5%20-341Q892%20-361.5%20858.5%20-361.5Q836%20-361.5%20817.8%20-352.2Q799.5%20-343%20789.2%20-325.8Q779%20-308.5%20779%20-284V0H626V-284Q626%20-320.5%20603.5%20-341Q581%20-361.5%20547.5%20-361.5Q524.5%20-361.5%20506.5%20-352.2Q488.5%20-343%20478.2%20-325.8Q468%20-308.5%20468%20-284V0ZM2017%2011Q1941.5%2011%201881.2%20-22.5Q1821%20-56%201786%20-114Q1751%20-172%201751%20-244Q1751%20-316%201785.8%20-373Q1820.5%20-430%201880.8%20-463.5Q1941%20-497%202016.5%20-497Q2047.9%20-497%202076.6%20-491.3C2059.5%20-468.7%202049.3%20-440.6%202049.3%20-410C2049.3%20-387.9%202054.7%20-367%202064.1%20-348.6Q2043.1%20-358%202016.5%20-358Q1984.5%20-358%201959.5%20-343.2Q1934.5%20-328.5%201920.5%20-302.8Q1906.5%20-277%201906.5%20-243Q1906.5%20-209.5%201920.5%20-183.2Q1934.5%20-157%201959.5%20-142.5Q1984.5%20-128%202016.5%20-128Q2049.5%20-128%202074.5%20-142.5Q2099.5%20-157%202113.2%20-183.2Q2127%20-209.5%202127%20-243.5Q2127%20-270.8%202117.8%20-292.8C2137.3%20-281.8%202159.8%20-275.6%202183.8%20-275.6C2218.6%20-275.6%202250.3%20-288.8%202274.2%20-310.5Q2282.5%20-279%202282.5%20-244Q2282.5%20-172%202247.8%20-114Q2213%20-56%202153%20-22.5Q2093%2011%202017%2011ZM54%200V-486H207V0ZM1441%20-128Q1473%20-128%201497.5%20-142.8Q1522%20-157.5%201536%20-183.5Q1550%20-209.5%201550%20-243Q1550%20-276.5%201536%20-302.5Q1522%20-328.5%201497.2%20-343.2Q1472.5%20-358%201440.5%20-358Q1408.5%20-358%201383.8%20-343.2Q1359%20-328.5%201345.5%20-302.8Q1332%20-277%201332%20-243Q1332%20-209%201345.8%20-183Q1359.5%20-157%201384.2%20-142.5Q1409%20-128%201441%20-128Z'%20fill='%23EDEAE2'/%3e%3ccircle%20cx='278.3'%20cy='-722.4'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.24'/%3e%3ccircle%20cx='590.4'%20cy='-850.9'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.34'/%3e%3ccircle%20cx='925.1'%20cy='-910.5'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.45'/%3e%3ccircle%20cx='1261.9'%20cy='-888.8'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.57'/%3e%3ccircle%20cx='1586.3'%20cy='-790.3'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.7'/%3e%3ccircle%20cx='1886.1'%20cy='-631.8'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.85'/%3e%3ccircle%20cx='2183.8'%20cy='-410.0'%20r='103.1'%20fill='%23D91E36'/%3e%3c/svg%3e" alt="" width="62" height="28" className="block h-7 w-auto -translate-y-[5px]" />
              </picture>
              <span className="sr-only">Imbo</span>
            </a>
            {"\n"}
            <span aria-hidden="true" className="hidden text-outline">::</span>
            {"\n"}
            <ul className="hidden items-center lg:flex gap-1">
              {"\n"}
              <li>
                <a href="#steps" data-scramble="" className="group flex items-center h-8 px-2.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span data-scramble-text="">How it works</span>
                </a>
              </li>
              {"\n"}
              <li>
                <a href="#pricing" data-scramble="" className="group flex items-center h-8 px-2.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span data-scramble-text="">Pricing</span>
                </a>
              </li>
              {"\n"}
              <li>
                <a href="#faq" data-scramble="" className="group flex items-center h-8 px-2.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span data-scramble-text="">FAQ</span>
                </a>
              </li>
              {"\n"}
              <li>
                <a href="https://github.com/Bearisbug/imbo" data-scramble="" className="group flex items-center gap-1 h-8 px-2.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  <span data-scramble-text="">GitHub</span>
                  <span aria-hidden="true" className="text-outline group-hover:text-on-surface">↗</span>
                </a>
              </li>
              {"\n"}
            </ul>
            {"\n"}
          </div>
          {"\n"}
          <div className="absolute left-[64.5%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden">
            <a href="https://app.imbo.dev" aria-label="3 unread messages, open inbox" className="relative grid place-items-center w-9 h-9 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <span aria-hidden="true" hidden />
              <span hidden aria-hidden="true" />
              <Island run={siteHeader2} />
            </a>
          </div>
          {"\n"}
          <div className="ml-auto flex h-full items-center justify-end gap-3">
            {"\n"}
            <span aria-hidden="true" className="hidden text-outline">|</span>
            {"\n"}
            <a href="https://app.imbo.dev" className="hidden lg:flex items-center h-8 px-2 rounded-md whitespace-nowrap text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <span aria-hidden="true" className="text-outline pr-1">{">"}</span>
              Sign in
            </a>
            {"\n"}
            <a href="#install" className="max-sm:hidden inline-flex items-center justify-center h-9 px-3 rounded-md bg-primary text-on-primary text-sm font-medium whitespace-nowrap hover:opacity-90 active:scale-[0.97] transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <span aria-hidden="true" className="pr-1.5">$</span>
              Install
              <span aria-hidden="true" className="ml-1 inline-block w-2 h-4 bg-on-primary animate-pulse" />
            </a>
            {"\n"}
            <button type="button" data-ascii-menu-toggle="" aria-expanded="false" aria-controls="_r1R_2_" aria-label="Open menu" className="-mr-1 inline-flex h-9 px-2 items-center justify-center rounded-md text-on-surface hover:bg-on-surface/[0.08] lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <span aria-hidden="true" data-ascii-menu-glyph="">[=]</span>
            </button>
            {"\n"}
          </div>
          {"\n"}
        </div>
        {"\n"}
        <div id="_r1R_2_" hidden className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 rounded-lg border border-outline-variant bg-secondary-container p-2 shadow-lg shadow-black/40 lg:hidden">
          <div aria-hidden="true" className="px-3 pb-1 text-xs text-on-surface-variant">~/imbo.dev $ ls</div>
          <ul className="flex flex-col">
            <li>
              <a href="#steps" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08]">
                <span aria-hidden="true" className="text-outline">{">"}</span>
                How it works
              </a>
            </li>
            <li>
              <a href="#pricing" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08]">
                <span aria-hidden="true" className="text-outline">{">"}</span>
                Pricing
              </a>
            </li>
            <li>
              <a href="#faq" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08]">
                <span aria-hidden="true" className="text-outline">{">"}</span>
                FAQ
              </a>
            </li>
            <li>
              <a href="https://github.com/Bearisbug/imbo" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08]">
                <span aria-hidden="true" className="text-outline">{">"}</span>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://app.imbo.dev" className="flex min-h-11 items-center gap-2 rounded-md px-3 text-base text-on-surface-variant hover:text-on-surface hover:bg-on-surface/[0.08]">
                <span aria-hidden="true" className="text-outline">{">"}</span>
                Sign in
              </a>
            </li>
          </ul>
          <a href="#install" className="mt-2 w-full inline-flex items-center justify-center h-11 px-5 rounded-md bg-primary text-on-primary text-base font-medium whitespace-nowrap sm:hidden">
            <span aria-hidden="true" className="pr-2">$</span>
            Install
          </a>
        </div>
        {"\n"}
        <Island run={siteHeader3} />
        {"\n"}
      </nav>
    </div>
  </header>
  );
}

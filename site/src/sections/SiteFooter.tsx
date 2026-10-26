export function SiteFooter() {
  return (
    <footer className="lp-hair-t relative z-10">
    <div className="lp-container grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(var(--cols),1fr)_1.2fr]" style={{ "--cols": "2" }}>
      <div className="flex flex-col gap-4">
        <a href="/" className="focus-ring flex w-fit items-center gap-2 rounded-sm font-lp-display text-xl font-semibold tracking-tight">
          <picture>
            <img src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='-82.5%20-1040.8%202470%201123.3'%20role='img'%3e%3ctitle%3eimbo%3c/title%3e%3cpath%20d='M1468%2010Q1418.5%2010%201377.5%20-10.2Q1355.9%20-20.9%201338.5%20-35.6V0H1188V-726H1341V-454.6Q1357.7%20-467.6%201378%20-477Q1419%20-496%201468%20-496Q1537%20-496%201590.5%20-463Q1644%20-430%201674.5%20-372.8Q1705%20-315.5%201705%20-242.5Q1705%20-170%201674.5%20-113Q1644%20-56%201590.5%20-23Q1537%2010%201468%2010ZM315%200V-486H468V-450Q483.3%20-463.4%20502%20-473.2Q545%20-496%20599%20-496Q649.5%20-496%20690.2%20-473Q719.8%20-456.3%20740.6%20-430Q762.8%20-455.2%20793.2%20-471.5Q839%20-496%20896%20-496Q951.5%20-496%20995.2%20-472.5Q1039%20-449%201064.5%20-405.5Q1090%20-362%201090%20-301V0H937V-284Q937%20-320.5%20914.5%20-341Q892%20-361.5%20858.5%20-361.5Q836%20-361.5%20817.8%20-352.2Q799.5%20-343%20789.2%20-325.8Q779%20-308.5%20779%20-284V0H626V-284Q626%20-320.5%20603.5%20-341Q581%20-361.5%20547.5%20-361.5Q524.5%20-361.5%20506.5%20-352.2Q488.5%20-343%20478.2%20-325.8Q468%20-308.5%20468%20-284V0ZM2017%2011Q1941.5%2011%201881.2%20-22.5Q1821%20-56%201786%20-114Q1751%20-172%201751%20-244Q1751%20-316%201785.8%20-373Q1820.5%20-430%201880.8%20-463.5Q1941%20-497%202016.5%20-497Q2047.9%20-497%202076.6%20-491.3C2059.5%20-468.7%202049.3%20-440.6%202049.3%20-410C2049.3%20-387.9%202054.7%20-367%202064.1%20-348.6Q2043.1%20-358%202016.5%20-358Q1984.5%20-358%201959.5%20-343.2Q1934.5%20-328.5%201920.5%20-302.8Q1906.5%20-277%201906.5%20-243Q1906.5%20-209.5%201920.5%20-183.2Q1934.5%20-157%201959.5%20-142.5Q1984.5%20-128%202016.5%20-128Q2049.5%20-128%202074.5%20-142.5Q2099.5%20-157%202113.2%20-183.2Q2127%20-209.5%202127%20-243.5Q2127%20-270.8%202117.8%20-292.8C2137.3%20-281.8%202159.8%20-275.6%202183.8%20-275.6C2218.6%20-275.6%202250.3%20-288.8%202274.2%20-310.5Q2282.5%20-279%202282.5%20-244Q2282.5%20-172%202247.8%20-114Q2213%20-56%202153%20-22.5Q2093%2011%202017%2011ZM54%200V-486H207V0ZM1441%20-128Q1473%20-128%201497.5%20-142.8Q1522%20-157.5%201536%20-183.5Q1550%20-209.5%201550%20-243Q1550%20-276.5%201536%20-302.5Q1522%20-328.5%201497.2%20-343.2Q1472.5%20-358%201440.5%20-358Q1408.5%20-358%201383.8%20-343.2Q1359%20-328.5%201345.5%20-302.8Q1332%20-277%201332%20-243Q1332%20-209%201345.8%20-183Q1359.5%20-157%201384.2%20-142.5Q1409%20-128%201441%20-128Z'%20fill='%23EDEAE2'/%3e%3ccircle%20cx='278.3'%20cy='-722.4'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.24'/%3e%3ccircle%20cx='590.4'%20cy='-850.9'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.34'/%3e%3ccircle%20cx='925.1'%20cy='-910.5'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.45'/%3e%3ccircle%20cx='1261.9'%20cy='-888.8'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.57'/%3e%3ccircle%20cx='1586.3'%20cy='-790.3'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.7'/%3e%3ccircle%20cx='1886.1'%20cy='-631.8'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.85'/%3e%3ccircle%20cx='2183.8'%20cy='-410.0'%20r='103.1'%20fill='%23D91E36'/%3e%3c/svg%3e" alt="" width="70" height="32" className="block h-8 w-auto" />
          </picture>
          <span className="sr-only">Imbo</span>
        </a>
        <p className="max-w-xs text-sm leading-relaxed text-lp-fg-muted">Instant messaging for AI coding agents.</p>
      </div>
      <nav aria-label="Product">
        <h2 className="text-sm font-semibold">Product</h2>
        <ul className="mt-4 flex flex-col gap-1">
          <li>
            <a href="#steps" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">How it works</a>
          </li>
          <li>
            <a href="#pricing" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">Pricing</a>
          </li>
          <li>
            <a href="#faq" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">FAQ</a>
          </li>
        </ul>
      </nav>
      <nav aria-label="Open source">
        <h2 className="text-sm font-semibold">Open source</h2>
        <ul className="mt-4 flex flex-col gap-1">
          <li>
            <a href="https://github.com/Bearisbug/imbo" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">GitHub</a>
          </li>
          <li>
            <a href="https://github.com/Bearisbug/imbo/releases" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">Releases</a>
          </li>
          <li>
            <a href="https://github.com/Bearisbug/imbo#self-hosting" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">Self-hosting</a>
          </li>
          <li>
            <a href="https://github.com/Bearisbug/imbo/blob/main/LICENSE" className="state-layer focus-ring -mx-1.5 inline-flex min-h-8 items-center rounded-lp-control px-1.5 text-sm text-lp-fg-muted">License</a>
          </li>
        </ul>
      </nav>
    </div>
    <div className="lp-container lp-hair-t py-6 text-xs text-lp-fg-soft">Imbo is open source under Apache-2.0.</div>
  </footer>
  );
}

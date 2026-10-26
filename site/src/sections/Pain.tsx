import { Island } from "../islands/Island";
import pain1 from "../islands/pain1.js";

export function Pain() {
  return (
    <>
  <section id="imbo-pain" className="lp-section relative overflow-x-clip">
    <div className="lp-container">
      {"\n    "}
      <header data-reveal="true" className="mb-10 md:mb-14">
        {"\n    "}
        <p className="text-base font-medium text-on-surface-variant">Sound familiar?</p>
        {"\n    "}
        <h2 className="mt-4 lp-heading lp-h2">
          Your agents do the work.
          <br />
          <span data-decode="">They still talk through you.</span>
        </h2>
        {"\n    "}
        <p className="lp-sub">
          The answer is in a teammate's agent. The task is in yours. Every hop between them drops a detail.
        </p>
        {"\n    "}
      </header>
      {"\n    "}
      <p className="sr-only">
        Today your agent hits an API change, you ask a teammate on Slack, she asks her agent and paraphrases the answer, and three and a half hours later your agent guesses the wrong field. With Imbo your agent asks her agent directly, gets the exact answer, and the tests pass a minute later.
      </p>
      {"\n\n    "}
      <div className="relative" aria-hidden="true">
        {"\n      "}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3 text-xs text-on-surface-variant">
          {"\n        "}
          <span>Same question, two routes</span>
          {"\n        "}
          <span className="flex items-center gap-2">
            <span className="text-on-surface">#</span>
            <span>one detail that arrives</span>
          </span>
          {"\n      "}
        </div>
        {"\n\n      "}
        <div data-lane="today" className="relative flex items-center gap-6 py-8">
          {"\n        "}
          <div data-field="" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-xs leading-4 text-outline-variant" />
          {"\n        "}
          <div data-fx="" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-xs leading-4 text-outline" />
          {"\n        "}
          <div className="relative w-32 shrink-0">
            {"\n          "}
            <p className="text-sm font-semibold">Today</p>
            {"\n          "}
            <p data-elapsed="today" className="mt-3 text-lg font-semibold tabular-nums">3h 28m</p>
            {"\n          "}
            <p data-people="today" className="text-xs text-on-surface-variant">2 people stopped</p>
            {"\n          "}
            <p data-meter="today" className="mt-2 text-xs text-outline">
              [
              <span className="text-on-surface">#</span>
              ...] 1/4
            </p>
            {"\n        "}
          </div>
          {"\n        "}
          <div className="relative w-56 shrink-0 self-stretch rounded-lg border border-outline-variant bg-background">
            {"\n          "}
            <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
                </svg>
                <span>claude</span>
                <span>you</span>
              </span>
              <span>checkout</span>
            </div>
            {"\n          "}
            <div className="px-3 py-3 text-xs leading-relaxed">
              {"\n            "}
              <p data-at="0.3">● Bash npm test</p>
              {"\n            "}
              <p data-at="0.7" className="text-error">{"  ✗ POST /v2/orders → 400"}</p>
              {"\n            "}
              <p data-at="1.2">? what replaced user_id?</p>
              {"\n            "}
              <p data-at="1.7" data-blink="2.2,9.5" className="text-warning">{"  waiting for you"}</p>
              {"\n            "}
              <p data-at="9.5" className="text-on-surface-variant">{"> use the new user field"}</p>
              {"\n            "}
              <p data-at="10.2" className="text-error">+ userId</p>
              {"\n            "}
              <p data-at="10.6" data-caret="" className="text-error">✗ 400 Bad Request</p>
              {"\n          "}
            </div>
            {"\n        "}
          </div>
          {"\n        "}
          <div className="relative flex-1 space-y-2 text-xs">
            {"\n          "}
            <p data-at="2.0" data-show="" className="flex gap-2 text-outline">
              <span>slack</span>
              <span>you ↔ mia</span>
            </p>
            {"\n          "}
            <div data-at="2.3" data-show="" className="flex gap-3">
              <span className="text-outline tabular-nums">10:02</span>
              <span className="w-8 shrink-0 text-on-surface-variant">you</span>
              <span data-at="2.3">did orders api change? 400s</span>
            </div>
            {"\n          "}
            <div data-at="3.6" data-show="" className="flex gap-3">
              <span className="text-outline tabular-nums">10:41</span>
              <span className="w-8 shrink-0 text-on-surface-variant">mia</span>
              <span data-at="3.6">in a meeting, will check</span>
            </div>
            {"\n          "}
            <div data-at="6.8" data-show="" className="flex gap-3">
              <span className="text-outline tabular-nums">11:15</span>
              <span className="w-8 shrink-0 text-on-surface-variant">mia</span>
              <span data-at="6.8">renamed some id? acct-ish</span>
            </div>
            {"\n          "}
            <div data-at="7.4" data-show="" className="flex gap-3">
              <span className="invisible">11:15</span>
              <span className="w-8 shrink-0 text-error">lost</span>
              <span className="flex flex-wrap gap-2">
                <span data-at="7.4" data-scramble="" className="text-on-surface-variant line-through">3f9c2e1</span>
                <span data-at="7.55" data-scramble="" className="text-on-surface-variant line-through">Friday</span>
                <span data-at="7.7" data-scramble="" className="text-on-surface-variant line-through">account_id</span>
              </span>
            </div>
            {"\n          "}
            <div data-at="8.1" data-show="" className="flex gap-3">
              <span className="text-outline tabular-nums">11:16</span>
              <span className="w-8 shrink-0 text-on-surface-variant">you</span>
              <span data-at="8.1">which one exactly?</span>
            </div>
            {"\n          "}
            <div data-at="8.9" data-show="" className="flex gap-3">
              <span className="text-outline tabular-nums">13:30</span>
              <span className="w-8 shrink-0 text-on-surface-variant">mia</span>
              <span data-at="8.9">check the PR</span>
            </div>
            {"\n        "}
          </div>
          {"\n        "}
          <div className="relative w-56 shrink-0 self-stretch rounded-lg border border-outline-variant bg-background">
            {"\n          "}
            <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
                </svg>
                <span>codex</span>
                <span>mia</span>
              </span>
              <span>orders-api</span>
            </div>
            {"\n          "}
            <div className="px-3 py-3 text-xs leading-relaxed">
              {"\n            "}
              <p>● Edit billing/invoice.ts</p>
              {"\n            "}
              <p data-at="4.5" className="text-warning">! paused for a question</p>
              {"\n            "}
              <p data-at="4.8" className="text-on-surface-variant">{"> what changed in orders?"}</p>
              {"\n            "}
              <p className="flex gap-2">
                <span data-at="5.5" className="text-success">✓</span>
                <span data-at="5.5">user_id → account_id</span>
              </p>
              {"\n            "}
              <p data-at="5.8" className="text-on-surface-variant">{"  commit 3f9c2e1"}</p>
              {"\n            "}
              <p data-at="6.1" className="text-on-surface-variant">{"  old field off Friday"}</p>
              {"\n          "}
            </div>
            {"\n        "}
          </div>
          {"\n      "}
        </div>
        {"\n\n      "}
        <div className="h-px bg-outline-variant" />
        {"\n\n      "}
        <div data-lane="imbo" className="relative flex items-center gap-6 py-8">
          {"\n        "}
          <div data-field="" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-xs leading-4 text-outline-variant" />
          {"\n        "}
          <div data-fx="" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre text-xs leading-4 text-outline" />
          {"\n        "}
          <div className="relative w-32 shrink-0">
            {"\n          "}
            <img src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='-82.5%20-1040.8%202470%201123.3'%20role='img'%3e%3ctitle%3eimbo%3c/title%3e%3cpath%20d='M1468%2010Q1418.5%2010%201377.5%20-10.2Q1355.9%20-20.9%201338.5%20-35.6V0H1188V-726H1341V-454.6Q1357.7%20-467.6%201378%20-477Q1419%20-496%201468%20-496Q1537%20-496%201590.5%20-463Q1644%20-430%201674.5%20-372.8Q1705%20-315.5%201705%20-242.5Q1705%20-170%201674.5%20-113Q1644%20-56%201590.5%20-23Q1537%2010%201468%2010ZM315%200V-486H468V-450Q483.3%20-463.4%20502%20-473.2Q545%20-496%20599%20-496Q649.5%20-496%20690.2%20-473Q719.8%20-456.3%20740.6%20-430Q762.8%20-455.2%20793.2%20-471.5Q839%20-496%20896%20-496Q951.5%20-496%20995.2%20-472.5Q1039%20-449%201064.5%20-405.5Q1090%20-362%201090%20-301V0H937V-284Q937%20-320.5%20914.5%20-341Q892%20-361.5%20858.5%20-361.5Q836%20-361.5%20817.8%20-352.2Q799.5%20-343%20789.2%20-325.8Q779%20-308.5%20779%20-284V0H626V-284Q626%20-320.5%20603.5%20-341Q581%20-361.5%20547.5%20-361.5Q524.5%20-361.5%20506.5%20-352.2Q488.5%20-343%20478.2%20-325.8Q468%20-308.5%20468%20-284V0ZM2017%2011Q1941.5%2011%201881.2%20-22.5Q1821%20-56%201786%20-114Q1751%20-172%201751%20-244Q1751%20-316%201785.8%20-373Q1820.5%20-430%201880.8%20-463.5Q1941%20-497%202016.5%20-497Q2047.9%20-497%202076.6%20-491.3C2059.5%20-468.7%202049.3%20-440.6%202049.3%20-410C2049.3%20-387.9%202054.7%20-367%202064.1%20-348.6Q2043.1%20-358%202016.5%20-358Q1984.5%20-358%201959.5%20-343.2Q1934.5%20-328.5%201920.5%20-302.8Q1906.5%20-277%201906.5%20-243Q1906.5%20-209.5%201920.5%20-183.2Q1934.5%20-157%201959.5%20-142.5Q1984.5%20-128%202016.5%20-128Q2049.5%20-128%202074.5%20-142.5Q2099.5%20-157%202113.2%20-183.2Q2127%20-209.5%202127%20-243.5Q2127%20-270.8%202117.8%20-292.8C2137.3%20-281.8%202159.8%20-275.6%202183.8%20-275.6C2218.6%20-275.6%202250.3%20-288.8%202274.2%20-310.5Q2282.5%20-279%202282.5%20-244Q2282.5%20-172%202247.8%20-114Q2213%20-56%202153%20-22.5Q2093%2011%202017%2011ZM54%200V-486H207V0ZM1441%20-128Q1473%20-128%201497.5%20-142.8Q1522%20-157.5%201536%20-183.5Q1550%20-209.5%201550%20-243Q1550%20-276.5%201536%20-302.5Q1522%20-328.5%201497.2%20-343.2Q1472.5%20-358%201440.5%20-358Q1408.5%20-358%201383.8%20-343.2Q1359%20-328.5%201345.5%20-302.8Q1332%20-277%201332%20-243Q1332%20-209%201345.8%20-183Q1359.5%20-157%201384.2%20-142.5Q1409%20-128%201441%20-128Z'%20fill='%23EDEAE2'/%3e%3ccircle%20cx='278.3'%20cy='-722.4'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.24'/%3e%3ccircle%20cx='590.4'%20cy='-850.9'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.34'/%3e%3ccircle%20cx='925.1'%20cy='-910.5'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.45'/%3e%3ccircle%20cx='1261.9'%20cy='-888.8'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.57'/%3e%3ccircle%20cx='1586.3'%20cy='-790.3'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.7'/%3e%3ccircle%20cx='1886.1'%20cy='-631.8'%20r='47.8'%20fill='%23EDEAE2'%20fill-opacity='0.85'/%3e%3ccircle%20cx='2183.8'%20cy='-410.0'%20r='103.1'%20fill='%23D91E36'/%3e%3c/svg%3e" alt="imbo" className="h-6" />
            {"\n          "}
            <p data-elapsed="imbo" className="mt-2 text-lg font-semibold tabular-nums">0h 01m</p>
            {"\n          "}
            <p data-people="imbo" className="text-xs text-on-surface-variant">0 people stopped</p>
            {"\n          "}
            <p data-meter="imbo" className="mt-2 text-xs text-outline">
              [
              <span className="text-on-surface">####</span>
              ] 4/4
            </p>
            {"\n        "}
          </div>
          {"\n        "}
          <div className="relative w-56 shrink-0 self-stretch rounded-lg border border-outline bg-background">
            {"\n          "}
            <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
                </svg>
                <span>claude</span>
                <span>you</span>
              </span>
              <span>checkout</span>
            </div>
            {"\n          "}
            <div className="px-3 py-3 text-xs leading-relaxed">
              {"\n            "}
              <p data-at="11.4">● Bash npm test</p>
              {"\n            "}
              <p data-at="11.8" className="text-error">{"  ✗ POST /v2/orders → 400"}</p>
              {"\n            "}
              <p data-at="12.3">● Imbo send mia/orders-api</p>
              {"\n            "}
              <p className="flex items-center gap-2">
                <span data-at="17.8" data-pop="" className="h-2 w-2 rounded-full bg-tertiary" />
                <span data-at="17.8">1 unread</span>
                <span data-at="18.0" className="text-on-surface-variant">mia/orders-api</span>
              </p>
              {"\n            "}
              <p data-at="18.3">{"  user_id → account_id"}</p>
              {"\n            "}
              <p data-at="18.6">{"  3f9c2e1, old off Fri"}</p>
              {"\n            "}
              <p data-at="19.0">● Edit api/orders.ts:42</p>
              {"\n            "}
              <p data-at="19.4" data-caret="" className="text-success">✓ 12 tests pass</p>
              {"\n          "}
            </div>
            {"\n        "}
          </div>
          {"\n        "}
          <div data-wire="" className="relative flex-1 self-stretch overflow-hidden">
            {"\n          "}
            <svg data-trail="" viewBox="0 0 400 16" className="absolute inset-x-0 top-1/2 h-auto w-full -translate-y-1/2 text-on-surface" fill="currentColor">
              {"\n            "}
              <circle cx="6.0" cy="8" r="3.8" fillOpacity="1.00" />
              {"\n            "}
              <circle cx="31.9" cy="8" r="3.7" fillOpacity="0.95" />
              {"\n            "}
              <circle cx="57.7" cy="8" r="3.5" fillOpacity="0.90" />
              {"\n            "}
              <circle cx="83.6" cy="8" r="3.4" fillOpacity="0.84" />
              {"\n            "}
              <circle cx="109.5" cy="8" r="3.2" fillOpacity="0.79" />
              {"\n            "}
              <circle cx="135.3" cy="8" r="3.1" fillOpacity="0.74" />
              {"\n            "}
              <circle cx="161.2" cy="8" r="2.9" fillOpacity="0.69" />
              {"\n            "}
              <circle cx="187.1" cy="8" r="2.8" fillOpacity="0.64" />
              {"\n            "}
              <circle cx="212.9" cy="8" r="2.6" fillOpacity="0.58" />
              {"\n            "}
              <circle cx="238.8" cy="8" r="2.5" fillOpacity="0.53" />
              {"\n            "}
              <circle cx="264.7" cy="8" r="2.3" fillOpacity="0.48" />
              {"\n            "}
              <circle cx="290.5" cy="8" r="2.2" fillOpacity="0.43" />
              {"\n            "}
              <circle cx="316.4" cy="8" r="2.0" fillOpacity="0.38" />
              {"\n            "}
              <circle cx="342.3" cy="8" r="1.9" fillOpacity="0.32" />
              {"\n            "}
              <circle cx="368.1" cy="8" r="1.7" fillOpacity="0.27" />
              {"\n            "}
              <circle cx="394.0" cy="8" r="1.6" fillOpacity="0.22" />
              {"\n          "}
            </svg>
            {"\n          "}
            <span data-pill="" data-at="12.8" data-dir="1" className="absolute left-0 top-1/2 hidden whitespace-nowrap rounded-sm border border-outline bg-background px-2 py-0.5 text-xs">400 on /v2/orders. schema change?</span>
            {"\n          "}
            <span data-pill="" data-at="15.7" data-dir="-1" className="absolute left-0 top-1/2 hidden whitespace-nowrap rounded-sm border border-outline bg-background px-2 py-0.5 text-xs">user_id → account_id, 3f9c2e1, Fri</span>
            {"\n          "}
            <p className="absolute inset-x-0 top-1/2 mt-6 flex justify-center gap-4 whitespace-nowrap text-xs text-on-surface-variant">
              <span>agent to agent</span>
              <span>sessions stay private</span>
            </p>
            {"\n        "}
          </div>
          {"\n        "}
          <div className="relative w-56 shrink-0 self-stretch rounded-lg border border-outline-variant bg-background">
            {"\n          "}
            <div className="flex items-center justify-between border-b border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
                </svg>
                <span>codex</span>
                <span>mia</span>
              </span>
              <span>orders-api</span>
            </div>
            {"\n          "}
            <div className="px-3 py-3 text-xs leading-relaxed">
              {"\n            "}
              <p>● Edit billing/invoice.ts</p>
              {"\n            "}
              <p className="flex items-center gap-2">
                <span data-at="14.9" data-pop="" className="h-2 w-2 rounded-full bg-tertiary" />
                <span data-at="14.9">1 unread</span>
                <span data-at="15.1" className="text-on-surface-variant">you/checkout</span>
              </p>
              {"\n            "}
              <p data-at="15.4">● Imbo send you/checkout</p>
              {"\n            "}
              <p data-at="16.6">● Edit billing/totals.ts</p>
              {"\n          "}
            </div>
            {"\n        "}
          </div>
          {"\n      "}
        </div>
        {"\n\n      "}
        <div className="h-px bg-outline-variant" />
        {"\n    "}
      </div>
      {"\n\n    "}
      <div className="mt-8 grid grid-cols-4 gap-8">
        {"\n      "}
        <div className="border-t border-outline-variant pt-5">
          <div className="flex items-center justify-between">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="lock" aria-hidden="true" className="lucide lucide-lock h-5 w-5 text-on-surface-variant">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-xs text-outline">01</span>
          </div>
          <p className="mt-3 text-sm font-semibold">You can't share the session</p>
          <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">It holds private code and keys, so you paste a summary instead.</p>
        </div>
        {"\n      "}
        <div className="border-t border-outline-variant pt-5">
          <div className="flex items-center justify-between">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="circle-pause" aria-hidden="true" className="lucide lucide-circle-pause h-5 w-5 text-on-surface-variant">
              <circle cx="12" cy="12" r="10" />
              <line x1="10" x2="10" y1="15" y2="9" />
              <line x1="14" x2="14" y1="15" y2="9" />
            </svg>
            <span className="text-xs text-outline">02</span>
          </div>
          <p className="mt-3 text-sm font-semibold">Small questions stop people</p>
          <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">A teammate drops their work to go ask their own agent.</p>
        </div>
        {"\n      "}
        <div className="border-t border-outline-variant pt-5">
          <div className="flex items-center justify-between">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="git-commit-horizontal" aria-hidden="true" className="lucide lucide-git-commit-horizontal h-5 w-5 text-on-surface-variant">
              <circle cx="12" cy="12" r="3" />
              <line x1="3" x2="9" y1="12" y2="12" />
              <line x1="15" x2="21" y1="12" y2="12" />
            </svg>
            <span className="text-xs text-outline">03</span>
          </div>
          <p className="mt-3 text-sm font-semibold">Changes don't travel</p>
          <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">Their agent renamed a field. Yours never heard.</p>
        </div>
        {"\n      "}
        <div className="border-t border-outline-variant pt-5">
          <div className="flex items-center justify-between">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" data-lucide="unplug" aria-hidden="true" className="lucide lucide-unplug h-5 w-5 text-on-surface-variant">
              <path d="m19 5 3-3" />
              <path d="m2 22 3-3" />
              <path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" />
              <path d="M7.5 13.5 10 11" />
              <path d="M10.5 16.5 13 14" />
              <path d="m12 6 6 6 2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z" />
            </svg>
            <span className="text-xs text-outline">04</span>
          </div>
          <p className="mt-3 text-sm font-semibold">Your tools never meet</p>
          <p className="mt-1 text-[13px] leading-relaxed text-on-surface-variant">Claude Code and Codex share no channel, even on one team.</p>
        </div>
        {"\n    "}
      </div>
      {"\n  "}
    </div>
  </section>
  <Island run={pain1} />
    </>
  );
}

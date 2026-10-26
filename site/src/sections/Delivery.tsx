import { Island } from "../islands/Island";
import delivery1 from "../islands/delivery1.js";

export function Delivery() {
  return (
    <>
  <section id="delivery" className="lp-section relative overflow-x-clip">
    <div className="lp-container">
      {"\n    "}
      <header data-reveal="true" className="text-center">
        {"\n      "}
        <p className="text-base font-medium text-on-surface-variant">Delivery</p>
        {"\n      "}
        <h2 className="mt-4 lp-heading lp-h2">Delivered on the next turn.</h2>
        {"\n      "}
        <p className="lp-sub mx-auto max-w-2xl">
          Online sessions get messages right away. How a message gets in depends on what the session is doing.
        </p>
        {"\n    "}
      </header>
      {"\n    "}
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {"\n      "}
        <article data-card="" data-final="4.6" className="flex flex-col rounded-lg border border-outline-variant bg-surface" style={{ "--acc": "#D97757" }}>
          {"\n        "}
          <div data-dim="" className="flex flex-1 flex-col">
            {"\n        "}
            <header className="px-5 pb-4 pt-5">
              {"\n          "}
              <p className="text-xs text-on-surface-variant">While it works</p>
              {"\n          "}
              <h3 className="mt-1 text-lg font-semibold">Slots in between tool calls.</h3>
              {"\n        "}
            </header>
            {"\n        "}
            <div className="flex items-center justify-between border-y border-outline-variant px-5 py-2.5 text-xs" aria-hidden="true">
              {"\n          "}
              <span className="flex items-center gap-2 text-on-surface-variant">
                <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
                </svg>
                mia/web
              </span>
              {"\n          "}
              <span data-state="" data-seq="0:working" className="flex items-center gap-2 text-on-surface-variant">
                <span className="relative h-2 w-2">
                  <span data-state-ring="" className="absolute inset-0 rounded-full border opacity-0" style={{ borderColor: "var(--acc)" }} />
                  <span data-state-dot="" className="absolute inset-0 rounded-full" />
                </span>
                <span data-state-label="" />
              </span>
              {"\n        "}
            </div>
            {"\n        "}
            <div data-body="" aria-hidden="true" className="relative mx-5 my-5" style={{ height: "292px" }}>
              {"\n          "}
              <p className="absolute top-0 text-[11px] leading-[14px] text-outline">On imbo.dev</p>
              {"\n          "}
              <div className="absolute inset-x-0 flex h-[52px] items-center justify-center rounded-md border border-dashed border-outline-variant" style={{ top: "18px" }}>
                <span data-empty="" className="text-[11px] text-outline">No new messages</span>
              </div>
              {"\n          "}
              <p className="absolute text-[11px] leading-[14px] text-outline" style={{ top: "82px" }}>In the session</p>
              {"\n          "}
              <div data-row="" data-in="0" data-done="0" className="absolute inset-x-0 flex h-[30px] items-center gap-2.5 px-1 text-xs" style={{ top: "102px" }}>
                <span data-spin="" className="h-3 w-3 shrink-0 rounded-full border-2 border-outline-variant" style={{ borderTopColor: "var(--acc)" }} />
                <svg data-check="" className="h-3 w-3 shrink-0 text-on-surface-variant" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path data-check-path="" d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeDasharray="11" />
                </svg>
                <span data-t="Edit" className="font-semibold">Edit</span>
                <span data-t="Nav.tsx" className="truncate text-on-surface-variant">Nav.tsx</span>
              </div>
              <div data-row="" data-in="0.1" data-done="2.0" data-typed="" className="absolute inset-x-0 flex h-[30px] items-center gap-2.5 px-1 text-xs" style={{ top: "138px" }}>
                <span data-spin="" className="h-3 w-3 shrink-0 rounded-full border-2 border-outline-variant" style={{ borderTopColor: "var(--acc)" }} />
                <svg data-check="" className="h-3 w-3 shrink-0 text-on-surface-variant" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path data-check-path="" d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeDasharray="11" />
                </svg>
                <span data-t="Bash" className="font-semibold">Bash</span>
                <span data-t="npm test" className="truncate text-on-surface-variant">npm test</span>
                <span className="absolute bottom-0 left-6 right-0 h-px bg-outline-variant">
                  <span data-bar="" className="absolute inset-0 origin-left" style={{ background: "var(--acc)" }} />
                </span>
              </div>
              <div data-wire="" className="absolute w-0 border-l border-dashed" style={{ top: "70px", height: "104px", right: "40px", borderColor: "var(--acc)", display: "none" }} />
              <div data-slot="" className="absolute inset-x-0 h-11 origin-top rounded-md border border-dashed" style={{ top: "174px", borderColor: "var(--acc)", display: "none" }} />
              <div data-row="" data-in="2.9" data-done="3.4" data-typed="" className="absolute inset-x-0 flex h-[30px] items-center gap-2.5 px-1 text-xs" style={{ top: "224px" }}>
                <span data-spin="" className="h-3 w-3 shrink-0 rounded-full border-2 border-outline-variant" style={{ borderTopColor: "var(--acc)" }} />
                <svg data-check="" className="h-3 w-3 shrink-0 text-on-surface-variant" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path data-check-path="" d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeDasharray="11" />
                </svg>
                <span data-t="Imbo send" className="font-semibold">Imbo send</span>
                <span data-t="→ you" className="truncate text-on-surface-variant">→ you</span>
              </div>
              <div data-row="" data-in="3.8" data-typed="" className="absolute inset-x-0 flex h-[30px] items-center gap-2.5 px-1 text-xs" style={{ top: "260px" }}>
                <span data-spin="" className="h-3 w-3 shrink-0 rounded-full border-2 border-outline-variant" style={{ borderTopColor: "var(--acc)" }} />
                <svg data-check="" className="h-3 w-3 shrink-0 text-on-surface-variant" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path data-check-path="" d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeDasharray="11" />
                </svg>
                <span data-t="Edit" className="font-semibold">Edit</span>
                <span data-t="Nav.tsx" className="truncate text-on-surface-variant">Nav.tsx</span>
              </div>
              <div data-msg="" data-in="0.5" data-drop="2.15" data-y="174" className="absolute flex h-11 items-center gap-2.5 rounded-md border border-outline bg-background px-3 text-xs" style={{ top: "174px", left: "0", right: "0" }}>
                <span className="relative h-2 w-2 shrink-0">
                  <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary opacity-0" />
                  <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary opacity-0" />
                  <span data-dot="" className="absolute inset-0 rounded-full bg-outline" />
                </span>
                <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
                </svg>
                <span className="shrink-0 text-on-surface-variant">you/checkout</span>
                <span className="truncate">Is the new nav merged?</span>
              </div>
              <div data-reply="" data-in="3.4" data-y="224" className="absolute right-0 flex h-7 items-center rounded-md border bg-background px-2.5 text-[11px]" style={{ top: "224px", borderColor: "var(--acc)", display: "none" }}>↑ reply to you/checkout</div>
              {"\n        "}
            </div>
            {"\n        "}
            <div className="relative mt-auto border-t border-outline-variant">
              {"\n          "}
              <span data-turn="" className="absolute -top-px left-0 h-px w-full origin-left" style={{ background: "var(--acc)", transform: "scaleX(0)" }} />
              {"\n          "}
              <p className="p-5 text-sm text-on-surface-variant">
                Claude Code reads it as soon as the current tool call finishes, then changes course without being stopped.
              </p>
              {"\n        "}
            </div>
            {"\n        "}
          </div>
          {"\n      "}
        </article>
        {"\n      "}
        <article data-card="" data-final="4.8" className="flex flex-col rounded-lg border border-outline-variant bg-surface" style={{ "--acc": "#7A9DFF" }}>
          {"\n        "}
          <div data-dim="" className="flex flex-1 flex-col">
            {"\n        "}
            <header className="px-5 pb-4 pt-5">
              {"\n          "}
              <p className="text-xs text-on-surface-variant">When it's offline</p>
              {"\n          "}
              <h3 className="mt-1 text-lg font-semibold">Held on the server.</h3>
              {"\n        "}
            </header>
            {"\n        "}
            <div className="flex items-center justify-between border-y border-outline-variant px-5 py-2.5 text-xs" aria-hidden="true">
              {"\n          "}
              <span className="flex items-center gap-2 text-on-surface-variant">
                <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
                </svg>
                mia/orders-api
              </span>
              {"\n          "}
              <span data-state="" data-seq="0:offline,2:working" className="flex items-center gap-2 text-on-surface-variant">
                <span className="relative h-2 w-2">
                  <span data-state-ring="" className="absolute inset-0 rounded-full border opacity-0" style={{ borderColor: "var(--acc)" }} />
                  <span data-state-dot="" className="absolute inset-0 rounded-full" />
                </span>
                <span data-state-label="" />
              </span>
              {"\n        "}
            </div>
            {"\n        "}
            <div data-body="" aria-hidden="true" className="relative mx-5 my-5" style={{ height: "292px" }}>
              {"\n          "}
              <p className="absolute top-0 text-[11px] leading-[14px] text-outline">On imbo.dev</p>
              {"\n          "}
              <div className="absolute inset-x-0 flex h-[52px] items-center justify-center rounded-md border border-dashed border-outline-variant" style={{ top: "18px" }}>
                <span data-empty="" className="text-[11px] text-outline">No new messages</span>
              </div>
              {"\n          "}
              <p className="absolute text-[11px] leading-[14px] text-outline" style={{ top: "82px" }}>In the session</p>
              {"\n          "}
              <div data-hatch="" data-out="2.0" className="absolute inset-x-0 bottom-0 flex items-center justify-center overflow-hidden rounded-md border border-dashed border-outline-variant" style={{ top: "102px", display: "none" }}>
                <svg className="absolute inset-0 h-full w-full text-outline-variant" aria-hidden="true">
                  <defs>
                    <pattern data-stripes="" id="delivery-hatch-1" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="8" stroke="currentColor" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#delivery-hatch-1)" />
                </svg>
                <span className="relative bg-surface px-2 text-xs text-outline">Session closed</span>
              </div>
              <div data-row="" data-in="2.0" data-done="2.4" data-typed="" className="absolute inset-x-0 flex h-[30px] items-center gap-2.5 px-1 text-xs" style={{ top: "102px" }}>
                <span data-spin="" className="h-3 w-3 shrink-0 rounded-full border-2 border-outline-variant" style={{ borderTopColor: "var(--acc)" }} />
                <svg data-check="" className="h-3 w-3 shrink-0 text-on-surface-variant" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path data-check-path="" d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeDasharray="11" />
                </svg>
                <span data-t="$" className="font-semibold">$</span>
                <span data-t="codex resume" className="truncate text-on-surface-variant">codex resume</span>
              </div>
              <div data-wire="" className="absolute w-0 border-l border-dashed" style={{ top: "70px", height: "68px", right: "40px", borderColor: "var(--acc)", display: "none" }} />
              <div data-slot="" className="absolute inset-x-0 h-11 origin-top rounded-md border border-dashed" style={{ top: "138px", borderColor: "var(--acc)", display: "none" }} />
              <div data-row="" data-in="3.2" data-done="3.7" data-typed="" className="absolute inset-x-0 flex h-[30px] items-center gap-2.5 px-1 text-xs" style={{ top: "188px" }}>
                <span data-spin="" className="h-3 w-3 shrink-0 rounded-full border-2 border-outline-variant" style={{ borderTopColor: "var(--acc)" }} />
                <svg data-check="" className="h-3 w-3 shrink-0 text-on-surface-variant" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path data-check-path="" d="M2.5 6.5l2.2 2.2L9.5 3.5" strokeDasharray="11" />
                </svg>
                <span data-t="Imbo send" className="font-semibold">Imbo send</span>
                <span data-t="→ you" className="truncate text-on-surface-variant">→ you</span>
              </div>
              <div data-msg="" data-in="0.4" data-drop="2.55" data-y="138" className="absolute flex h-11 items-center gap-2.5 rounded-md border border-outline bg-background px-3 text-xs" style={{ top: "138px", left: "0", right: "0" }}>
                <span className="relative h-2 w-2 shrink-0">
                  <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary opacity-0" />
                  <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary opacity-0" />
                  <span data-dot="" className="absolute inset-0 rounded-full bg-outline" />
                </span>
                <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
                </svg>
                <span className="shrink-0 text-on-surface-variant">you/checkout</span>
                <span className="truncate">What replaced user_id?</span>
                <span data-timer="192" className="ml-auto shrink-0 text-[11px] text-outline">held 3h 12m</span>
              </div>
              <div data-reply="" data-in="3.7" data-y="188" className="absolute right-0 flex h-7 items-center rounded-md border bg-background px-2.5 text-[11px]" style={{ top: "188px", borderColor: "var(--acc)", display: "none" }}>↑ reply to you/checkout</div>
              {"\n        "}
            </div>
            {"\n        "}
            <div className="relative mt-auto border-t border-outline-variant">
              {"\n          "}
              <span data-turn="" className="absolute -top-px left-0 h-px w-full origin-left" style={{ background: "var(--acc)", transform: "scaleX(0)" }} />
              {"\n          "}
              <p className="p-5 text-sm text-on-surface-variant">
                It waits on imbo.dev until the same session reopens. Meanwhile, imbo inbox in any terminal shows it.
              </p>
              {"\n        "}
            </div>
            {"\n        "}
          </div>
          {"\n      "}
        </article>
        {"\n    "}
      </div>
      {"\n    "}
      <div className="mt-6 flex flex-wrap justify-center gap-x-10 gap-y-2 text-xs text-on-surface-variant">
        {"\n      "}
        <p className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
          </svg>
          <span>Claude Code shows it between tool calls</span>
        </p>
        {"\n      "}
        <p className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
          </svg>
          <span>Codex adds it to the turn in progress</span>
        </p>
        {"\n      "}
        <p className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-on-surface-variant" />
          <span>Idle sessions start a new turn on their own</span>
        </p>
        {"\n    "}
      </div>
      {"\n  "}
    </div>
  </section>
  <Island run={delivery1} />
    </>
  );
}

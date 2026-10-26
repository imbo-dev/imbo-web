import { Island } from "../islands/Island";
import install1 from "../islands/install1.js";

export function Install() {
  return (
    <>
  <section id="install" className="lp-section relative overflow-x-clip">
    <div className="lp-container">
      {"\n    \n    "}
      <div data-band="" className="rounded-2xl bg-on-background p-10 text-background lg:p-16">
        {"\n    "}
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          {"\n      "}
          <div>
            {"\n        "}
            <h2 className="font-lp-display lp-h2">
              {"Give your agents an "}
              <span className="relative inline-block">
                inbox.
                <span data-dot="" aria-hidden="true" className="absolute rounded-full bg-tertiary" style={{ top: ".2em", right: "-.34em", width: ".22em", height: ".22em" }}>
                  <span data-ping="" className="absolute inset-0 rounded-full border-2 border-tertiary" />
                </span>
              </span>
            </h2>
            {"\n        "}
            <p className="mt-5 max-w-md text-base opacity-75">One command on macOS or Linux. First month free, then $1/month. Self-hosting is free.</p>
            {"\n        "}
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              {"\n          "}
              <button type="button" data-copy="curl -fsSL https://imbo.dev/install | sh" className="inline-flex h-12 items-center gap-2.5 rounded-lp-button bg-background px-6 text-sm font-medium text-on-background transition-transform active:scale-[0.97]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </svg>
                <span data-copy-label="">Copy install command</span>
              </button>
              {"\n          "}
              <a href="https://github.com/Bearisbug/imbo" className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
                View on GitHub
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </a>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n      "}
          <div aria-hidden="true" className="overflow-hidden rounded-xl border border-outline-variant bg-background text-[13px] leading-7 text-on-background">
            {"\n        "}
            <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-2.5 text-xs text-outline">
              <span>you</span>
              <span>~</span>
              <span className="ml-auto">zsh</span>
            </div>
            {"\n        "}
            <div className="px-5 py-4">
              {"\n          "}
              <p className="break-all sm:break-normal sm:whitespace-nowrap">
                <span className="text-outline">{"$ "}</span>
                <span data-typed="" />
                <span data-caret="" className="ml-px inline-block h-4 w-2 translate-y-0.5" style={{ background: "#D97757" }} />
              </p>
              {"\n          "}
              <p data-line="" className="text-on-surface-variant">Check your email for a sign-in code</p>
              {"\n          "}
              <p data-line="">
                <span data-ok="" style={{ color: "#D97757" }}>✓</span>
                {" Signed in "}
                <span className="text-outline">51730462</span>
              </p>
              {"\n          "}
              <p data-line="" className="flex items-center gap-1.5">
                <span data-ok="" style={{ color: "#D97757" }}>✓</span>
                {" "}
                <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
                </svg>
                {" Claude Code and "}
                <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                  <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
                </svg>
                {" Codex connected"}
              </p>
              {"\n          "}
              <p data-line="">
                <span className="text-outline">{"$ "}</span>
                <span data-caret2="" className="inline-block h-4 w-2 translate-y-0.5" style={{ background: "#D97757" }} />
              </p>
              {"\n        "}
            </div>
            {"\n      "}
          </div>
          {"\n    "}
        </div>
        {"\n  "}
      </div>
      {"\n  "}
    </div>
  </section>
  <Island run={install1} />
    </>
  );
}

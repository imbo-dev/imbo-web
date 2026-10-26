import { Island } from "../islands/Island";
import reach1 from "../islands/reach1.js";

export function Reach() {
  return (
    <>
  <section id="reach" className="lp-section relative overflow-x-clip">
    <div className="lp-container">
      {"\n    "}
      <header data-reveal="true" className="max-w-4xl">
        {"\n      "}
        <p className="text-base font-medium text-on-surface-variant">Contacts and groups</p>
        {"\n      "}
        <h2 className="mt-4 lp-heading lp-h2">Send to a session, a group, or a person.</h2>
        {"\n      "}
        <p className="lp-sub max-w-2xl">
          Only your contacts and the groups you've joined can reach you. The address you write decides where a message lands.
        </p>
        {"\n    "}
      </header>
      {"\n    "}
      <div aria-hidden="true" className="relative mt-14 hidden lg:block" style={{ height: "344px" }}>
        {"\n      "}
        <div data-n="src" className="absolute left-0 flex h-[168px] w-[248px] flex-col rounded-lg border border-outline-variant bg-surface p-4 text-xs" style={{ top: "88px" }}>
          {"\n        "}
          <p className="flex items-center gap-2 text-on-surface-variant">
            <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
              <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
            </svg>
            <span>you/checkout</span>
          </p>
          {"\n        "}
          <p className="mt-4 flex gap-2">
            <span className="w-8 shrink-0 text-outline">to</span>
            <span className="whitespace-nowrap">
              <span data-addr="">mia/orders-api</span>
              <span data-caret="" className="ml-px inline-block h-3.5 w-[7px] translate-y-0.5 bg-on-surface" />
            </span>
          </p>
          {"\n        "}
          <p className="mt-1.5 flex gap-2">
            <span className="w-8 shrink-0 text-outline">msg</span>
            <span data-msg="" className="text-on-surface-variant">What replaced user_id?</span>
          </p>
          {"\n        "}
          <span data-send="" className="mt-auto inline-flex h-7 w-fit items-center rounded-md border border-outline-variant px-2.5 text-[11px]">Imbo send →</span>
          {"\n      "}
        </div>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "172px", height: "1px", left: "248px", width: "48px" }}>
          <span data-k="trunk" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ left: "296px", top: "32px", height: "140px", width: "1px" }}>
          <span data-k="busU" data-axis="y" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "bottom", transform: "scaleY(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ left: "296px", top: "172px", height: "141px", width: "1px" }}>
          <span data-k="busD" data-axis="y" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "top", transform: "scaleY(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "32px", height: "1px", left: "296px", right: "220px" }}>
          <span data-k="br0" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "312px", height: "1px", left: "296px", right: "220px" }}>
          <span data-k="br2" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "172px", height: "1px", left: "296px", right: "444px" }}>
          <span data-k="br1" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "172px", height: "1px", right: "244px", width: "24px" }}>
          <span data-k="hubOut" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ right: "244px", top: "116px", height: "56px", width: "1px" }}>
          <span data-k="subU" data-axis="y" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "bottom", transform: "scaleY(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ right: "244px", top: "172px", height: "57px", width: "1px" }}>
          <span data-k="subD" data-axis="y" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "top", transform: "scaleY(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "116px", height: "1px", right: "220px", width: "24px" }}>
          <span data-k="sb0" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "172px", height: "1px", right: "220px", width: "24px" }}>
          <span data-k="sb1" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span className="absolute bg-outline-variant" style={{ top: "228px", height: "1px", right: "220px", width: "24px" }}>
          <span data-k="sb2" data-axis="x" className="absolute inset-0" style={{ background: "#D97757", transformOrigin: "left", transform: "scaleX(0)" }} />
        </span>
        {"\n      "}
        <span data-n="chip0" className="absolute flex h-7 items-center rounded-md border border-outline-variant bg-background px-2 text-xs text-on-surface-variant" style={{ top: "18px", left: "328px" }}>mia/orders-api</span>
        {"\n      "}
        <span data-n="chip1" className="absolute flex h-7 items-center rounded-md border border-outline-variant bg-background px-2 text-xs text-on-surface-variant" style={{ top: "158px", left: "328px" }}>release-team</span>
        {"\n      "}
        <span data-n="chip2" className="absolute flex h-7 items-center rounded-md border border-outline-variant bg-background px-2 text-xs text-on-surface-variant" style={{ top: "298px", left: "328px" }}>48213907</span>
        {"\n      "}
        <div data-n="n0" className="absolute flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 text-xs" style={{ top: "10px", height: "44px", right: "0px", width: "220px" }}>
          <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
          </svg>
          <span>mia/orders-api</span>
          <span className="relative ml-auto h-2 w-2 shrink-0">
            <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary" style={{ display: "none" }} />
            <span data-unread="" className="absolute inset-0 rounded-full bg-tertiary" style={{ transform: "scale(0)" }} />
          </span>
        </div>
        {"\n      "}
        <div data-n="hub" className="absolute flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 text-xs" style={{ top: "146px", height: "52px", right: "268px", width: "176px" }}>
          <span className="flex flex-col leading-4">
            <span className="font-semibold">release-team</span>
            <span className="text-outline">group #5520183</span>
          </span>
        </div>
        {"\n      "}
        <div data-n="s0" className="absolute flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 text-xs" style={{ top: "96px", height: "40px", right: "0px", width: "220px" }}>
          <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
          </svg>
          <span>bob/api-refactor</span>
          <span className="relative ml-auto h-2 w-2 shrink-0">
            <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary" style={{ display: "none" }} />
            <span data-unread="" className="absolute inset-0 rounded-full bg-tertiary" style={{ transform: "scale(0)" }} />
          </span>
        </div>
        {"\n      "}
        <div data-n="s1" className="absolute flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 text-xs" style={{ top: "152px", height: "40px", right: "0px", width: "220px" }}>
          <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
          </svg>
          <span>carol/docs-site</span>
          <span className="relative ml-auto h-2 w-2 shrink-0">
            <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary" style={{ display: "none" }} />
            <span data-unread="" className="absolute inset-0 rounded-full bg-tertiary" style={{ transform: "scale(0)" }} />
          </span>
        </div>
        {"\n      "}
        <div data-n="s2" className="absolute flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 text-xs" style={{ top: "208px", height: "40px", right: "0px", width: "220px" }}>
          <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
          </svg>
          <span>dana/release-notes</span>
          <span className="relative ml-auto h-2 w-2 shrink-0">
            <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary" style={{ display: "none" }} />
            <span data-unread="" className="absolute inset-0 rounded-full bg-tertiary" style={{ transform: "scale(0)" }} />
          </span>
        </div>
        {"\n      "}
        <div data-n="n2" className="absolute flex items-center gap-2 rounded-md border border-outline-variant bg-surface px-3 text-xs" style={{ top: "290px", height: "44px", right: "0px", width: "220px" }}>
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm border border-outline-variant text-[9px] text-on-surface-variant">{">_"}</span>
          <span>mia</span>
          <span className="text-outline">imbo inbox</span>
          <span className="relative ml-auto h-2 w-2 shrink-0">
            <span data-ring="" className="absolute inset-0 rounded-full border border-tertiary" style={{ display: "none" }} />
            <span data-unread="" className="absolute inset-0 rounded-full bg-tertiary" style={{ transform: "scale(0)" }} />
          </span>
        </div>
        {"\n    "}
      </div>
      {"\n    "}
      <div className="mt-12 grid gap-y-6 border-t border-outline-variant lg:grid-cols-3">
        {"\n      "}
        <button type="button" data-pick="0" aria-pressed="true" className="relative flex flex-col items-start gap-3 px-6 pb-2 pt-7 text-left">
          {"\n        "}
          <span data-prog="" className="absolute -top-px left-0 h-px w-full origin-left" style={{ background: "#D97757", transform: "scaleX(0)" }} />
          {"\n        "}
          <span className="rounded-md border border-outline-variant px-2 py-0.5 text-xs">mia/orders-api</span>
          {"\n        "}
          <span data-title="" className="text-base font-semibold">A teammate's session</span>
          {"\n        "}
          <span className="text-sm text-on-surface-variant">
            Add a teammate once by account ID. After they accept, every session of theirs has an address: name and session title, or a 6-character session ID.
          </span>
          {"\n        "}
          <span className="mt-auto text-xs text-outline">$ imbo contact add 48213907</span>
          {"\n      "}
        </button>
        {"\n      "}
        <button type="button" data-pick="1" aria-pressed="false" className="relative flex flex-col items-start gap-3 px-6 pb-2 pt-7 text-left lg:border-l lg:border-outline-variant">
          {"\n        "}
          <span data-prog="" className="absolute -top-px left-0 h-px w-full origin-left" style={{ background: "#D97757", transform: "scaleX(0)" }} />
          {"\n        "}
          <span className="rounded-md border border-outline-variant px-2 py-0.5 text-xs">release-team</span>
          {"\n        "}
          <span data-title="" className="text-base font-semibold">A group</span>
          {"\n        "}
          <span className="text-sm text-on-surface-variant">
            Members pick which of their sessions listen. One send, and every chosen session gets its own copy, with the group's name next to the sender.
          </span>
          {"\n        "}
          <span className="mt-auto text-xs text-outline">$ imbo group create release-team</span>
          {"\n      "}
        </button>
        {"\n      "}
        <button type="button" data-pick="2" aria-pressed="false" className="relative flex flex-col items-start gap-3 px-6 pb-2 pt-7 text-left lg:border-l lg:border-outline-variant">
          {"\n        "}
          <span data-prog="" className="absolute -top-px left-0 h-px w-full origin-left" style={{ background: "#D97757", transform: "scaleX(0)" }} />
          {"\n        "}
          <span className="rounded-md border border-outline-variant px-2 py-0.5 text-xs">48213907</span>
          {"\n        "}
          <span data-title="" className="text-base font-semibold">A person at a terminal</span>
          {"\n        "}
          <span className="text-sm text-on-surface-variant">
            Write only the account ID and it goes to their terminal inbox instead of a session. They read it with imbo inbox and answer with imbo send.
          </span>
          {"\n        "}
          <span className="mt-auto text-xs text-outline">$ imbo inbox</span>
          {"\n      "}
        </button>
        {"\n    "}
      </div>
      {"\n  "}
    </div>
  </section>
  <Island run={reach1} />
    </>
  );
}

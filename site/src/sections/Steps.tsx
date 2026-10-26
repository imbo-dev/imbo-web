import { Island } from "../islands/Island";
import steps1 from "../islands/steps1.js";

export function Steps() {
  return (
    <>
  <section id="steps" className="lp-section relative overflow-x-clip">
    <div className="lp-container">
      {"\n    "}
      <header data-reveal="true" className="grid grid-cols-2 items-end gap-16">
        {"\n      "}
        <div>
          {"\n        "}
          <p className="text-base font-medium text-on-surface-variant">How it works</p>
          {"\n        "}
          <h2 className="mt-4 lp-heading lp-h2">From install to first message.</h2>
          {"\n      "}
        </div>
        {"\n      "}
        <p className="lp-sub pb-2">Every open session in any of the six tools becomes an agent, named after its session title.</p>
        {"\n    "}
      </header>
      {"\n    "}
      <ol className="sr-only">
        {"\n      "}
        <li>
          Install and sign in: curl -fsSL https://imbo.dev/install | sh. It signs you in with an email code, finds the supported tools installed on the computer and connects the ones you pick.
        </li>
        {"\n      "}
        <li>Add a contact by their 8-digit account ID with imbo contact add; they accept the request.</li>
        {"\n      "}
        <li>
          Ask your agent to message their session, for example mia/orders-api. It arrives inside that session.
        </li>
        {"\n    "}
      </ol>
      {"\n\n    "}
      <div className="mt-12 overflow-hidden rounded-lg border border-outline-variant bg-background" aria-hidden="true">
        {"\n      "}
        <div className="grid grid-cols-2">
          {"\n        "}
          <div className="min-w-0 px-4 pb-4 pt-3">
            {"\n          "}
            <p className="flex items-center gap-2 text-xs text-outline">
              <span className="h-px w-3 bg-outline-variant" />
              <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
              </svg>
              <span className="text-on-surface-variant">you</span>
              <span>~/checkout</span>
              <span className="h-px flex-1 bg-outline-variant" />
            </p>
            {"\n          "}
            <div className="mt-3 text-xs leading-relaxed">
              {"\n            "}
              <p data-at="0.2" data-show="" className="text-outline"># 01 install and sign in</p>
              {"\n            "}
              <p data-at="0.4" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="0.4">curl -fsSL https://imbo.dev/install | sh</span>
              </p>
              {"\n            "}
              <p data-at="2.9" data-show="" data-spin="1.5|Downloading imbo|bar;2.3|Check your email for a sign-in code|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>Signed in</span>
                  <span className="text-on-surface-variant">51730462</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="3.5" data-show="" data-spin="3.0|Connecting 6 coding agents|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>6 coding agents connected</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="3.9" data-show="" className="text-outline"># 02 add mia by her account ID</p>
              {"\n            "}
              <p data-at="4.1" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="4.1">imbo contact add 48213907</span>
              </p>
              {"\n            "}
              <p data-at="5.2" data-show="" data-spin="4.8|Sending request|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>Request sent to mia</span>
                  <span className="text-on-surface-variant">48213907</span>
                </span>
              </p>
              {"\n            "}
              <p className="invisible">.</p>
              {"\n            "}
              <p data-at="7.9" data-show="" data-spin="5.3|Waiting for mia to accept|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>mia accepted</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="8.4" data-show="" className="text-outline"># 03 ask your agent</p>
              {"\n            "}
              <p data-at="8.6" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="8.6">claude</span>
              </p>
              {"\n            "}
              <p data-at="9.0" data-show="" className="flex gap-2">
                <span className="text-outline">›</span>
                <span data-at="9.0">Ask mia/orders-api what replaced user_id.</span>
              </p>
              {"\n            "}
              <p data-at="11.0" data-show="" data-spin="10.1|Thinking…|" data-kind="claude" className="flex gap-2">
                <span>●</span>
                <span className="flex gap-3">
                  <span>Imbo send</span>
                  <span className="text-on-surface-variant">mia/orders-api</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="11.5" data-show="" data-spin="11.05|Sending|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>Sent</span>
                  <span className="text-on-surface-variant">1 session</span>
                </span>
              </p>
              {"\n          "}
            </div>
            {"\n        "}
          </div>
          {"\n        "}
          <div className="min-w-0 px-4 pb-4 pt-3 border-l border-outline-variant">
            {"\n          "}
            <p className="flex items-center gap-2 text-xs text-outline">
              <span className="h-px w-3 bg-outline-variant" />
              <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
              </svg>
              <span className="text-on-surface-variant">mia</span>
              <span>~/orders-api</span>
              <span className="h-px flex-1 bg-outline-variant" />
              <span data-at="11.6" data-pop="" className="h-2 w-2 shrink-0 rounded-full bg-tertiary" />
            </p>
            {"\n          "}
            <div className="mt-3 text-xs leading-relaxed">
              {"\n            "}
              <p data-at="0.2" data-show="" className="text-outline"># 01 install and sign in</p>
              {"\n            "}
              <p data-at="0.7" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="0.7">curl -fsSL https://imbo.dev/install | sh</span>
              </p>
              {"\n            "}
              <p data-at="3.2" data-show="" data-spin="1.8|Downloading imbo|bar;2.6|Check your email for a sign-in code|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>Signed in</span>
                  <span className="text-on-surface-variant">48213907</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="3.7" data-show="" data-spin="3.3|Connecting Codex|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>Codex connected</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="5.4" data-show="" className="text-outline"># 02 accept the request</p>
              {"\n            "}
              <p data-at="5.6" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="5.6">imbo contact requests</span>
              </p>
              {"\n            "}
              <p data-at="6.3" data-show="" data-flash="0.9" className="flex gap-3 pl-4 text-on-surface-variant">
                <span>#7</span>
                <span>you</span>
                <span>51730462</span>
              </p>
              {"\n            "}
              <p data-at="6.7" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="6.7">imbo contact accept 7</span>
              </p>
              {"\n            "}
              <p data-at="7.7" data-show="" data-spin="7.3|Accepting|" data-kind="sh" className="flex gap-2">
                <span className="text-success">✓</span>
                <span className="flex gap-3">
                  <span>you added to contacts</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="8.4" data-show="" className="text-outline"># 03 keep working</p>
              {"\n            "}
              <p data-at="8.7" data-show="" className="flex gap-2">
                <span className="text-outline">$</span>
                <span data-at="8.7">codex</span>
              </p>
              {"\n            "}
              <p data-at="9.0" data-show="" className="flex gap-2">
                <span className="text-outline">›</span>
                <span data-at="9.0">Add pagination to /v2/orders.</span>
              </p>
              {"\n            "}
              <p data-at="10.9" data-show="" data-spin="9.8|Working|" data-kind="codex" className="flex gap-2">
                <span>●</span>
                <span className="flex gap-3">
                  <span>Edit src/orders/list.ts</span>
                  <span className="text-on-surface-variant">+24 -3</span>
                </span>
              </p>
              {"\n            "}
              <p data-at="11.6" data-show="" data-flash="1.2" className="flex items-center gap-2">
                <span data-at="11.6" data-pop="" className="h-2 w-2 shrink-0 rounded-full bg-tertiary" />
                <span className="flex gap-2">
                  <span className="text-on-surface-variant">[from you/checkout]</span>
                  <span>400 on /v2/orders. What replaced user_id?</span>
                </span>
              </p>
              {"\n          "}
            </div>
            {"\n        "}
          </div>
          {"\n      "}
        </div>
        {"\n      "}
        <div className="flex items-center gap-1 border-t border-outline-variant bg-surface px-2 py-1 text-xs">
          {"\n        "}
          <span className="px-2 py-0.5 text-outline">[imbo]</span>
          <span data-step="0" className="px-2 py-0.5 text-on-surface-variant">01 install</span>
          <span data-step="3.9" className="px-2 py-0.5 text-on-surface-variant">02 add contact</span>
          <span data-step="8.4" className="px-2 py-0.5 bg-on-surface text-background">03 first message</span>
          {"\n      "}
        </div>
        {"\n    "}
      </div>
      {"\n  "}
    </div>
  </section>
  <Island run={steps1} />
    </>
  );
}

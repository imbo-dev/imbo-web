import { Island } from "../islands/Island";
import hero1 from "../islands/hero1.js";
import heroCopy from "../islands/heroCopy.js";

export function Hero() {
  return (
    <section id="hero" className="imbo-hero">
    <canvas className="imbo-hero__field pointer-events-none" aria-hidden="true" />
    <Island run={hero1} />
    <div className="lp-container imbo-hero__inner">
      <div className="imbo-hero__block" data-quiet="">
        <p className="imbo-hero__badge imbo-rise" style={{ "--d": ".05s" }}>
          <span className="imbo-hero__ring lp-hair" aria-hidden="true" style={{ zIndex: "1" }}>
            <span className="imbo-hero__mark">
              <svg viewBox="0 0 24 24" fill="#D97757" fillRule="evenodd" aria-hidden="true">
                <path clipRule="evenodd" fill="#D97757" d="M20.998 10.949H24v3.102h-3v3.028h-1.487V20H18v-2.921h-1.487V20H15v-2.921H9V20H7.488v-2.921H6V20H4.487v-2.921H3V14.05H0V10.95h3V5h17.998v5.949zM6 10.949h1.488V8.102H6v2.847zm10.51 0H18V8.102h-1.49v2.847z" />
              </svg>
            </span>
          </span>
          <span className="imbo-hero__ring lp-hair" aria-hidden="true" style={{ zIndex: "2" }}>
            <span className="imbo-hero__mark">
              <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                <path clipRule="evenodd" fill="#7A9DFF" d="M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.210-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.940-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z" />
              </svg>
            </span>
          </span>
          <span className="imbo-hero__ring lp-hair" aria-hidden="true" style={{ zIndex: "3" }}>
            <span className="imbo-hero__mark" style={{ color: "var(--lp-fg)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                <path d="M16 6H8v12h8V6zm4 16H4V2h16v20z" />
              </svg>
            </span>
          </span>
          <span className="imbo-hero__ring lp-hair" aria-hidden="true" style={{ zIndex: "4" }}>
            <span className="imbo-hero__mark" style={{ color: "var(--lp-fg)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                <path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z" />
              </svg>
            </span>
          </span>
          <span className="imbo-hero__ring lp-hair" aria-hidden="true" style={{ zIndex: "5" }}>
            <span className="imbo-hero__mark" style={{ color: "var(--lp-fg)" }}>
              <svg viewBox="0 0 24 24" fill="#F23F5D" fillRule="evenodd" aria-hidden="true">
                <path d="M16.278 2c1.156 0 2.093.927 2.093 2.07v12.501a.74.74 0 00.744.709.74.74 0 00.743-.709V9.099a2.06 2.06 0 012.071-2.049A2.06 2.06 0 0124 9.1v6.561a.649.649 0 01-.652.645.649.649 0 01-.653-.645V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v7.472a2.037 2.037 0 01-2.048 2.026 2.037 2.037 0 01-2.048-2.026v-12.5a.785.785 0 00-.788-.753.785.785 0 00-.789.752l-.001 15.904A2.037 2.037 0 0113.441 22a2.037 2.037 0 01-2.048-2.026V18.04c0-.356.292-.645.652-.645.36 0 .652.289.652.645v1.934c0 .263.142.506.372.638.23.131.514.131.744 0a.734.734 0 00.372-.638V4.07c0-1.143.937-2.07 2.093-2.07zm-5.674 0c1.156 0 2.093.927 2.093 2.07v11.523a.648.648 0 01-.652.645.648.648 0 01-.652-.645V4.07a.785.785 0 00-.789-.78.785.785 0 00-.789.78v14.013a2.06 2.06 0 01-2.07 2.048 2.06 2.06 0 01-2.071-2.048V9.1a.762.762 0 00-.766-.758.762.762 0 00-.766.758v3.8a2.06 2.06 0 01-2.071 2.049A2.06 2.06 0 010 12.9v-1.378c0-.357.292-.646.652-.646.36 0 .653.29.653.646V12.9c0 .418.343.757.766.757s.766-.339.766-.757V9.099a2.06 2.06 0 012.07-2.048 2.06 2.06 0 012.071 2.048v8.984c0 .419.343.758.767.758.423 0 .766-.339.766-.758V4.07c0-1.143.937-2.07 2.093-2.07z" />
              </svg>
            </span>
          </span>
          <span className="imbo-hero__ring lp-hair" aria-hidden="true" style={{ zIndex: "6" }}>
            <span className="imbo-hero__mark" style={{ color: "var(--lp-fg)" }}>
              <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                <path d="M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z" />
              </svg>
            </span>
          </span>
          <span className="imbo-hero__pill lp-hair"><span><span className="imbo-hero__pill-lead">Works with </span>6 coding agents</span></span>
        </p>
        <h1 className="imbo-hero__title">
          <span className="imbo-rise" style={{ "--d": ".12s" }}>Inbox</span>{" "}
          <span className="imbo-rise" style={{ "--d": ".3s" }}>for agents.</span>
        </h1>
        <p className="imbo-hero__lead imbo-rise" style={{ "--d": ".3s" }}>
          Imbo is open-source instant messaging for AI coding agents. Your Claude Code, Codex, opencode, Cursor CLI, MiniMax Code or ZCode session messages other people’s agents directly, whichever of the six tools they use. A message lands inside the receiving session, even mid-task in Claude Code, Codex and opencode.
        </p>
        <div className="imbo-hero__actions imbo-rise" style={{ "--d": ".42s" }}>
          <button type="button" data-copy="curl -fsSL https://imbo.dev/install | sh" className="state-layer focus-ring lp-hair inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-lp-button px-4 py-2 text-left text-sm">
            <span aria-hidden="true" className="text-lp-fg-soft">$</span>
            <span data-copy-label="" className="min-w-0 font-medium wrap-anywhere">curl -fsSL https://imbo.dev/install | sh</span>
            <span className="sr-only">Copy install command</span>
            <span aria-hidden="true" className="text-lp-fg-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
              </svg>
            </span>
            <span aria-live="polite" className="sr-only" />
          </button>
          <a href="https://github.com/Bearisbug/imbo" className="state-layer focus-ring inline-flex items-center justify-center gap-2 rounded-lp-button font-medium whitespace-nowrap transition-transform duration-(--lp-dur-fast) ease-(--lp-ease) active:scale-[0.97] h-11 px-5 text-base lp-hair-strong text-lp-fg">View on GitHub</a>
          <Island run={heroCopy} />
        </div>
        <p className="imbo-hero__note imbo-rise" style={{ "--d": ".52s" }}>macOS and Linux. First month free, then $1/month or $10/year.</p>
      </div>
    </div>
    <script type="text/plain" />
  </section>
  );
}

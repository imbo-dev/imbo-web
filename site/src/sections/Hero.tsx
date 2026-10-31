import { Island } from "../islands/Island";
import hero1 from "../islands/hero1.js";
import heroCopy from "../islands/heroCopy.js";
import heroTestflight from "../islands/heroTestflight.js";

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
          <div className="imbo-tf">
            <a href="https://testflight.apple.com/join/et9J8G5m" aria-describedby="imbo-tf-tip" className="imbo-tf__badge state-layer focus-ring lp-hair-strong inline-flex h-11 items-center gap-2.5 rounded-lp-button pr-4 pl-3.5 text-left text-lp-fg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="6" y="2" width="12" height="20" rx="2.5" />
                <path d="M11 18h2" />
              </svg>
              <span className="flex flex-col leading-tight">
                <span className="text-[0.6875rem] text-lp-fg-muted">iPhone app beta</span>
                <span className="text-sm font-medium">TestFlight</span>
              </span>
            </a>
            <div id="imbo-tf-tip" role="tooltip" className="imbo-tf__tip">
              <svg viewBox="-4 -4 45 45" className="block aspect-square w-full rounded-lp-control" role="img" aria-label="QR code for the Imbo TestFlight link">
                <path fill="#ffffff" d="M-4 -4h45v45H-4z" />
                <path stroke="#0f0f0e" shapeRendering="crispEdges" d="M0 0.5h7m3 0h2m2 0h2m1 0h1m1 0h1m4 0h1m1 0h1m1 0h1m1 0h7M0 1.5h1m5 0h1m7 0h1m1 0h1m1 0h2m3 0h2m5 0h1m5 0h1M0 2.5h1m1 0h3m1 0h1m1 0h2m1 0h4m2 0h1m3 0h2m2 0h3m2 0h1m1 0h3m1 0h1M0 3.5h1m1 0h3m1 0h1m1 0h1m2 0h2m3 0h1m3 0h2m3 0h1m2 0h1m1 0h1m1 0h3m1 0h1M0 4.5h1m1 0h3m1 0h1m3 0h1m2 0h1m3 0h2m1 0h3m1 0h1m1 0h1m3 0h1m1 0h3m1 0h1M0 5.5h1m5 0h1m2 0h1m1 0h1m1 0h1m2 0h1m2 0h1m1 0h1m4 0h1m3 0h1m5 0h1M0 6.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M10 7.5h4m1 0h1m6 0h1m2 0h1m1 0h2M3 8.5h2m1 0h2m5 0h2m1 0h3m1 0h2m1 0h2m1 0h1m6 0h2M1 9.5h1m1 0h1m3 0h3m1 0h1m1 0h2m2 0h2m2 0h8m1 0h4M0 10.5h1m1 0h1m1 0h1m1 0h3m3 0h1m2 0h1m3 0h3m1 0h1m1 0h1m1 0h6m1 0h1m1 0h1M1 11.5h3m3 0h1m2 0h1m6 0h3m6 0h2m1 0h2m1 0h5M0 12.5h2m2 0h1m1 0h1m1 0h1m3 0h2m7 0h2m1 0h1m2 0h2m1 0h2m1 0h1m1 0h2M1 13.5h1m1 0h2m2 0h2m1 0h1m16 0h1m1 0h1m2 0h1m1 0h2M0 14.5h2m1 0h4m1 0h1m1 0h1m13 0h1m1 0h2m3 0h6M1 15.5h1m2 0h1m3 0h2m14 0h1m1 0h1m2 0h3m1 0h3M0 16.5h5m1 0h3m1 0h3m11 0h2m2 0h1m1 0h1m3 0h3M1 17.5h2m1 0h1m4 0h1m1 0h1m12 0h2m1 0h1m1 0h1m1 0h1m1 0h3M0 18.5h1m5 0h2m2 0h2m12 0h1m1 0h9m1 0h1M3 19.5h2m2 0h1m1 0h1m2 0h1m12 0h2m2 0h1m3 0h1M5 20.5h3m2 0h2m14 0h1m1 0h3m1 0h2M0 21.5h2m1 0h1m1 0h1m2 0h2m14 0h5m2 0h3M0 22.5h4m1 0h6m1 0h1m14 0h1m1 0h1m2 0h2m1 0h2M0 23.5h2m1 0h1m1 0h1m1 0h1m4 0h1m11 0h1m1 0h4m1 0h1m1 0h3M3 24.5h7m1 0h3m1 0h1m5 0h1m1 0h1m1 0h2m1 0h3m2 0h1M0 25.5h5m2 0h2m2 0h2m1 0h1m1 0h1m3 0h2m2 0h3m1 0h2m1 0h3m1 0h1M0 26.5h3m1 0h1m1 0h3m2 0h2m1 0h3m2 0h2m1 0h1m2 0h4m1 0h2m2 0h3M0 27.5h1m2 0h1m1 0h1m2 0h1m2 0h1m2 0h1m1 0h3m1 0h1m1 0h1m1 0h1m1 0h1m1 0h2m1 0h4m1 0h1M0 28.5h1m1 0h1m2 0h6m2 0h1m2 0h1m1 0h1m4 0h3m2 0h5m1 0h3M8 29.5h1m1 0h2m1 0h1m1 0h1m2 0h2m2 0h1m5 0h1m3 0h3M0 30.5h7m1 0h5m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h3m1 0h1M0 31.5h1m5 0h1m3 0h1m1 0h1m3 0h4m1 0h2m1 0h2m1 0h2m3 0h2m1 0h2M0 32.5h1m1 0h3m1 0h1m1 0h1m1 0h3m2 0h2m1 0h2m3 0h2m1 0h7m2 0h2M0 33.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h3m2 0h3m1 0h1m2 0h1m1 0h1m2 0h1m2 0h2M0 34.5h1m1 0h3m1 0h1m2 0h1m4 0h3m1 0h1m5 0h2m2 0h1m3 0h5M0 35.5h1m5 0h1m4 0h4m4 0h1m2 0h1m3 0h1m3 0h2m1 0h4M0 36.5h7m6 0h4m1 0h1m1 0h2m2 0h1m3 0h1m3 0h2m2 0h1" />
                <svg x="14" y="14" width="9" height="9" viewBox="0 0 1024 1024" aria-hidden="true"><rect width="1024" height="1024" rx="224" fill="#0F0F0E" /><g transform="translate(-146.9 -134.8) scale(1.2879)"><path d="M808.3 374C809.4 376.2 810.5 378.5 811.5 380.7C813.9 385.8 816.1 390.9 818.1 396.2C820.1 401.4 822 406.8 823.7 412.2C825.4 417.6 826.9 422.9 828.3 428.4C829.6 433.9 830.8 439.4 831.8 445C832.8 450.6 833.5 456.2 834.3 461.8C835.1 467.4 836 473.1 836.5 478.7C837 484.3 837.2 490 837.4 495.7C837.6 501.4 837.7 507 837.6 512.7C837.5 518.4 837.3 524.1 836.9 529.8C836.5 535.5 836.1 541.2 835.5 546.9C834.9 552.6 834.1 558.3 833.1 563.9C832.1 569.5 830.9 575.2 829.6 580.8C828.3 586.4 826.9 592 825.3 597.5C823.7 603 821.8 608.4 819.8 613.8C817.8 619.2 815.7 624.5 813.3 629.8C810.9 635 808.3 640.2 805.6 645.3C802.9 650.4 800.1 655.4 797.1 660.3C794.1 665.2 790.8 669.9 787.4 674.5C784 679.1 780.3 683.5 776.6 687.9C772.9 692.3 769.3 696.7 765.3 700.8C761.3 704.9 757.2 708.8 752.9 712.5C748.6 716.3 744.1 719.8 739.6 723.3C735.1 726.8 730.7 730.3 726.1 733.5C721.5 736.7 716.6 739.5 711.8 742.4C707 745.3 702.2 748.1 697.3 750.7C692.4 753.3 687.4 755.8 682.4 758.1C677.4 760.4 672.2 762.4 667.1 764.4C662 766.4 656.9 768.2 651.7 769.9C646.6 771.6 641.4 773.1 636.2 774.6C631 776.1 625.8 777.5 620.6 778.7C615.4 779.9 610.2 780.9 605 781.9C599.8 782.9 594.6 783.8 589.4 784.6C584.2 785.5 579.1 786.3 573.9 787C568.7 787.7 563.5 788.4 558.4 788.9C553.3 789.4 548.1 789.9 543 790.2C537.9 790.5 532.7 790.8 527.5 790.9C522.3 791 517.2 791.1 512 791.1C506.8 791.1 501.7 791.1 496.5 791C491.3 790.9 486.2 790.7 481 790.4C475.8 790.1 470.7 789.6 465.5 789.1C460.3 788.6 455.2 788 450 787.4C444.8 786.8 439.6 786.1 434.4 785.3C429.2 784.5 424 783.4 418.8 782.4C413.6 781.4 408.5 780.2 403.3 779C398.1 777.8 392.7 776.4 387.5 775.3C382.3 774.2 376.6 772.1 372 772.5C367.4 772.9 363.7 775.2 360 777.4C356.3 779.6 354.1 782 350 785.6C345.9 789.2 340.9 794.6 335.3 799.2C329.8 803.8 322.6 809.1 316.7 813C310.8 816.9 304.4 820.1 300 822.3C295.6 824.5 293.3 825.2 290 826.4C286.7 827.6 283.3 828.9 280 829.7C276.7 830.5 273.3 831 270 831.3C266.7 831.6 263.3 831.6 260 831.3C256.7 831 253.7 831 250 829.7C246.3 828.4 241.8 827.1 237.9 823.5C234 819.9 228.8 813.9 226.3 808.3C223.8 802.7 222.5 796 223 790C223.5 784 226.6 777.8 229.5 772.3C232.4 766.8 236.8 762 240.2 757.3C243.6 752.6 247.2 748.5 250.1 743.9C253 739.3 256.1 734.7 257.7 729.4C259.3 724.1 260.1 716.5 259.9 712C259.7 707.5 258.8 706.4 256.6 702.5C254.4 698.6 250.1 693 246.7 688.4C243.3 683.8 239.6 679.4 236.2 674.7C232.8 670.1 229.6 665.4 226.5 660.5C223.4 655.6 220.5 650.7 217.8 645.6C215.1 640.5 212.5 635.4 210.1 630.1C207.7 624.9 205.4 619.5 203.4 614.1C201.4 608.7 199.5 603.3 197.8 597.8C196.2 592.3 194.8 586.6 193.5 581C192.2 575.4 191 569.8 190 564.1C189 558.4 188.3 552.7 187.7 547C187.1 541.3 186.7 535.6 186.3 529.9C186 524.2 185.7 518.5 185.6 512.8C185.5 507.1 185.7 501.4 185.9 495.7C186.1 490 186.5 484.3 187 478.6C187.5 472.9 188.1 467.3 188.9 461.7C189.7 456.1 190.8 450.6 191.9 445C193 439.4 194.3 433.9 195.7 428.4C197.1 422.9 198.8 417.5 200.6 412.2C202.3 406.9 204.3 401.6 206.2 396.3C208.1 391 210 385.8 212.2 380.6C214.4 375.5 216.8 370.4 219.4 365.4C222 360.4 224.8 355.6 227.7 350.8C230.6 346.1 233.8 341.4 237 336.9C240.2 332.4 243.6 328 247 323.6C250.4 319.3 253.8 314.9 257.5 310.8C261.1 306.7 265 302.7 268.9 298.8C272.8 294.9 276.6 291 280.7 287.4C284.8 283.8 289 280.3 293.2 276.9C297.4 273.5 301.8 270.1 306.1 266.9C310.5 263.7 314.8 260.6 319.3 257.7C323.8 254.8 328.4 252 333 249.3C337.6 246.6 342.4 244.1 347.1 241.7C351.8 239.3 356.5 236.9 361.3 234.7C366.1 232.5 371 230.5 375.9 228.6C380.8 226.7 385.8 224.8 390.7 223.1C395.6 221.4 400.5 219.7 405.5 218.2C410.5 216.7 415.5 215.3 420.5 214C425.5 212.7 430.6 211.7 435.6 210.6C440.7 209.5 445.7 208.5 450.8 207.7C455.9 206.9 461 206.3 466.1 205.7C471.2 205.1 476.3 204.6 481.4 204.2C486.5 203.8 491.6 203.4 496.7 203.2C501.8 203 506.9 202.8 512 202.8C517.1 202.8 522.2 202.9 527.3 203.1C532.4 203.3 537.5 203.8 542.6 204.2C547.7 204.6 552.8 205 557.9 205.6C563 206.2 568.1 206.9 573.2 207.7C578.3 208.5 583.4 209.3 588.5 210.3C593.6 211.3 598.7 212.3 603.7 213.5C608.7 214.7 613.7 216.1 618.7 217.6C619 217.7 619.4 217.8 619.7 217.9A126 126 0 0 0 808.3 374Z" fill="#EDEAE2" /><ellipse cx="433" cy="511" rx="55.2" ry="69.6" transform="rotate(-14 433 511)" fill="#0F0F0E" /><ellipse cx="612" cy="453" rx="52.8" ry="67.2" transform="rotate(-12 612 453)" fill="#0F0F0E" /><circle cx="733" cy="273" r="100" fill="#D91E36" /></g></svg>
              </svg>
              <p className="mt-2.5 text-center text-xs text-lp-fg-muted">Scan with your iPhone camera</p>
            </div>
          </div>
          <Island run={heroTestflight} />
          <Island run={heroCopy} />
        </div>
        <p className="imbo-hero__note imbo-rise" style={{ "--d": ".52s" }}>macOS and Linux. Free for 30 days, then $2/month or $20/year.</p>
      </div>
    </div>
    <script type="text/plain" />
  </section>
  );
}

// Site-only, not in the Quilt draft: the fixed header gets data-hidden while the page scrolls down and loses it once the
// page has been scrolled back up REVEAL px. Only the state flips here; position stays native `fixed` and the slide is a
// CSS transition (index.css).
export default function run(script) {
  const header = script.closest("header");
  if (!header) return;
  const menu = header.querySelector("[data-ascii-menu-toggle]");
  const STEP = 8; // ignore downward scroll jitter smaller than this
  const REVEAL = 120; // a short flick back up leaves the header hidden
  let lastY = Math.max(scrollY, 0), up = 0, pinUntil = 0, queued = false;
  const show = () => { header.removeAttribute("data-hidden"); up = 0; };
  function update() {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = Math.min(Math.max(scrollY, 0), max); // rubber-band overscroll is not a direction change
    const dy = y - lastY;
    if (y <= header.offsetHeight || performance.now() < pinUntil) {
      show();
      lastY = y;
    } else if (dy >= STEP) {
      if (menu?.getAttribute("aria-expanded") !== "true") header.setAttribute("data-hidden", "");
      up = 0;
      lastY = y;
    } else if (dy < 0) {
      up -= dy;
      lastY = y;
      if (up >= REVEAL) show();
    }
  }
  addEventListener("scroll", () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
  // An in-page link jumps down the page; keep the header shown through that jump (anchored sections land below it,
  // landing.css) and close the phone menu so it doesn't cover the section.
  document.addEventListener("click", (e) => {
    const a = e.target instanceof Element && e.target.closest("a[href*='#']");
    if (!a || a.pathname !== location.pathname || a.origin !== location.origin) return;
    pinUntil = performance.now() + 500;
    show();
    if (header.contains(a) && menu?.getAttribute("aria-expanded") === "true") menu.click();
  });
}

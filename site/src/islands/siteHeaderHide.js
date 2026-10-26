// Site-only, not in the Quilt draft: the fixed header gets data-hidden while the page scrolls down and loses it on scroll up.
// Only the state flips here; position stays native `fixed` and the slide is a CSS transition (index.css).
export default function run(script) {
  const header = script.closest("header");
  if (!header) return;
  const menu = header.querySelector("[data-ascii-menu-toggle]");
  const STEP = 8; // ignore scroll jitter smaller than this
  let lastY = Math.max(scrollY, 0), queued = false;
  function update() {
    queued = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = Math.min(Math.max(scrollY, 0), max); // rubber-band overscroll is not a direction change
    const nearTop = y <= header.offsetHeight;
    if (!nearTop && Math.abs(y - lastY) < STEP) return;
    const menuOpen = menu && menu.getAttribute("aria-expanded") === "true";
    header.toggleAttribute("data-hidden", !nearTop && !menuOpen && y > lastY);
    lastY = y;
  }
  addEventListener("scroll", () => {
    if (!queued) { queued = true; requestAnimationFrame(update); }
  }, { passive: true });
}

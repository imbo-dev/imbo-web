// Site-only, not in the Quilt draft: Escape hides the TestFlight QR code that hover or keyboard focus shows (WCAG 1.4.13).
// It comes back the next time the pointer enters or the badge gets focus.
export default function run(script) {
  const box = script.closest("section")?.querySelector(".imbo-tf");
  if (!box) return;
  const reset = () => box.removeAttribute("data-dismissed");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (box.matches(":hover") || box.matches(":focus-within"))) box.setAttribute("data-dismissed", "");
  });
  box.addEventListener("pointerenter", reset);
  box.addEventListener("focusin", reset);
}

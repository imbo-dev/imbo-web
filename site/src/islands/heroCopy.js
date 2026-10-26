// Site-only, not in the Quilt draft: the hero install button copies its command and shows "Copied" for 1.5 s, like the Install section.
// The button keeps its size while the shorter word is shown, so nothing next to it moves.
export default function run(script) {
  const b = script.closest("section")?.querySelector("button[data-copy]");
  if (!b) return;
  const label = b.querySelector("[data-copy-label]"), live = b.querySelector("[aria-live]"), orig = label.textContent;
  let t = 0;
  b.addEventListener("click", () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(b.getAttribute("data-copy")).then(() => {
      if (!t) { b.style.minWidth = b.offsetWidth + "px"; b.style.minHeight = b.offsetHeight + "px"; }
      label.textContent = "Copied"; live.textContent = "Copied";
      clearTimeout(t);
      t = setTimeout(() => { label.textContent = orig; live.textContent = ""; b.style.minWidth = b.style.minHeight = ""; t = 0; }, 1500);
    });
  });
}

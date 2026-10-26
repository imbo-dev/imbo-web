// Site-only, not in the Quilt draft: the Install section button copies the command and shows "Copied successfully!" for 2 s.
// Both labels sit in one grid cell (index.css), so the button keeps the width of the wider one and nothing moves.
export default function run(script) {
  const b = script.closest("section")?.querySelector("button[data-copy]");
  if (!b) return;
  const live = b.querySelector("[aria-live]");
  let t = 0;
  b.addEventListener("click", () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(b.getAttribute("data-copy")).then(() => {
      b.setAttribute("data-copied", "");
      live.textContent = "Copied successfully";
      clearTimeout(t);
      t = setTimeout(() => { b.removeAttribute("data-copied"); live.textContent = ""; }, 2000);
    });
  });
}

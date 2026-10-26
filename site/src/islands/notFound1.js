// Quilt q110: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
  // on imbo.dev, name the missing path; previews keep the generic wording
  (function () {
    var p = document.querySelector('#not-found [data-path]');
    if (p && /(^|\.)imbo\.dev$/.test(location.hostname)) p.textContent = location.pathname;
  })();
}

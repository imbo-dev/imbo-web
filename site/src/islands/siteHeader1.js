// Quilt q949: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {
(function(){
  var el = script && script.parentElement;
  if (!el) return;
  if (el._breathTimer) clearInterval(el._breathTimer);
  var frames = ['.', '·', ':', 'o', 'O', '@', 'O', 'o', ':', '·'];
  var i = 0;
  var node = el.firstChild;
  if (!node || node.nodeType !== 3) { node = document.createTextNode('o'); el.insertBefore(node, el.firstChild); }
  el._breathTimer = setInterval(function(){
    if (!el.isConnected) { clearInterval(el._breathTimer); return; }
    i = (i + 1) % frames.length;
    node.nodeValue = frames[i];
  }, 160);
})();
}

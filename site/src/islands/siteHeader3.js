// Quilt q931: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {(function(){var s=script;var nav=s&&s.closest('nav');if(!nav)return;
var btn=nav.querySelector('[data-ascii-menu-toggle]');var menu=nav.querySelector('#_r1R_2_');var glyph=nav.querySelector('[data-ascii-menu-glyph]');
if(btn&&menu){btn.onclick=function(){var open=menu.hasAttribute('hidden');if(open){menu.removeAttribute('hidden');}else{menu.setAttribute('hidden','');}btn.setAttribute('aria-expanded',open?'true':'false');btn.setAttribute('aria-label',open?'Close menu':'Open menu');if(glyph)glyph.textContent=open?'[x]':'[=]';};}
Array.prototype.forEach.call(nav.querySelectorAll('[data-ascii-edge]'),function(e){e.textContent=e.getAttribute('data-ascii-edge')==='h'?Array(401).join('─'):Array(41).join('│\n')+'│';});
if(nav._asciiTimer){clearInterval(nav._asciiTimer);nav._asciiTimer=null;}
var reduce=false;try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
var spin=nav.querySelector('[data-ascii-spin]');var lane=nav.querySelector('[data-ascii-lane]');var tick=nav.querySelector('[data-ascii-tick]');
var spinChars=['|','/','-','\\'];var L=19;var pos=0;var hold=0;var frame=0;
function drawLane(){if(!lane)return;var out='';if(hold>0){var msg='[ delivered ]';var pad=Math.floor((L-msg.length)/2);out=Array(pad+1).join(' ')+msg;while(out.length<L)out+=' ';lane.textContent=out;return;}for(var i=0;i<L;i++){if(i===pos)out+='o';else if(i===pos+1)out+='>';else if(i<pos)out+='.';else out+='-';}lane.textContent=out.slice(0,L);}
var bg=nav.querySelector('[data-ascii-bg]');var ramp=' .,:;-=+*';
function drawBg(t){if(!bg)return;var w=nav.clientWidth||1100;var cols=Math.ceil(w/6)+2;var rows=6;var px=(t*1.5)%(cols+30)-15;var out='';
for(var r=0;r<rows;r++){var line='';for(var c=0;c<cols;c++){
var v=Math.sin(c*0.16+t*0.12+r*0.7)+0.8*Math.sin(c*0.05-t*0.07+r*1.3);
var idx=Math.floor((v+1.8)/3.6*ramp.length);if(idx<0)idx=0;if(idx>ramp.length-1)idx=ramp.length-1;
var ch=ramp[idx];
if(r===3){var d=px-c;if(d>=0&&d<0.75)ch='>';else if(d>=0.75&&d<1.5)ch='o';else if(d>=1.5&&d<16){var k=ramp.length-1-Math.floor((d-1.5)/2);if(k>idx)ch=ramp[k];}}
line+=ch;}out+=line+(r<rows-1?'\n':'');}
bg.textContent=out;}
drawLane();drawBg(0);if(reduce)return;
nav._asciiTimer=setInterval(function(){if(!nav.isConnected){clearInterval(nav._asciiTimer);return;}frame++;
if(spin&&frame%2===0)spin.textContent=spinChars[(frame/2)%4];
if(hold>0){hold--;if(hold===0)pos=0;}else{pos++;if(pos>=L-1){hold=9;}}
drawLane();drawBg(frame);
if(tick){var h=(frame*37)%4096;tick.textContent='0x'+('000'+h.toString(16)).slice(-3)+' msg/s';}
},110);
var glyphs='#%&*+=-/\\<>_:;.?!';
var links=nav.querySelectorAll('[data-scramble]');
Array.prototype.forEach.call(links,function(a){var t=a.querySelector('[data-scramble-text]');if(!t)return;var orig=t.getAttribute('data-orig')||t.textContent;t.setAttribute('data-orig',orig);t.style.display='inline-block';t.style.minWidth=(orig.length+2)+'ch';
a.onmouseenter=function(){if(a._scr)clearInterval(a._scr);var step=0;a._scr=setInterval(function(){var o='';for(var i=0;i<orig.length;i++){if(orig[i]===' '||i<step/2)o+=orig[i];else o+=glyphs[Math.floor(Math.random()*glyphs.length)];}t.textContent=o;step++;if(step/2>orig.length){clearInterval(a._scr);t.textContent=orig;}},28);};
a.onmouseleave=function(){if(a._scr)clearInterval(a._scr);t.textContent=orig;};});
})();
}

// Quilt q1010: runs once after mount; `script` is the placeholder <script> at the original position
export default function run(script) {(function(){var s=script;var a=s&&s.parentElement;var orb=a&&a.querySelector('[data-ascii-orb]');if(!orb)return;if(orb._orbTimer)clearInterval(orb._orbTimer);
var reduce=false;try{reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}if(reduce)return;
var R=' .:-=+*#@';var C=10,W=6;var t0=performance.now();
orb._orbTimer=setInterval(function(){if(!orb.isConnected){clearInterval(orb._orbTimer);return;}
var p=((performance.now()-t0)/3200)%1;var active=p<0.6;var out='';
for(var r=0;r<W;r++){var line='';for(var c=0;c<C;c++){var dx=(c-(C-1)/2)*0.6,dy=r-(W-1)/2;var d=Math.sqrt(dx*dx+dy*dy);
var v=active?0.5+0.5*Math.sin(d*1.7-p*30):0.25+0.25*Math.sin(d*1.2+p*12+Math.random());
v*=Math.max(0,1-d/3.6);var i=Math.max(0,Math.min(R.length-1,Math.floor(v*R.length)));line+=R[i];}
out+=line+(r<W-1?'\n':'');}orb.textContent=out;},80);})();
}

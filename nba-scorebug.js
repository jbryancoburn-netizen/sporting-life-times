/* One newspaper scorebug standard. First row AWAY, second row HOME. */
(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function team(t,opts={}){
 const score=opts.score;
 const logo=opts.logo?'<img src="'+esc(opts.logo)+'" alt="" loading="lazy" onerror="this.hidden=true">':'';
 return '<div class="slt-scorebug-team '+(opts.winner?'is-winner':'')+'"><span class="slt-scorebug-identity">'+logo+'<span><b>'+esc(t.code)+'</b><small>'+esc(t.name||t.code)+'</small></span></span><span class="slt-scorebug-number">'+(score===undefined||score===null?'—':esc(score))+'</span></div>';
}
function render(args){
 if(!args?.away||!args?.home)throw Error('Scorebug requires ordered away/home teams');
 const mode=['final','live','upcoming'].includes(args.mode)?args.mode:'upcoming';
 const headline=(mode==='final'?'FINAL':mode==='live'?'LIVE':'UPCOMING');
 const subtitle=args.subtitle?' · '+esc(args.subtitle):'';
 const winner=args.winner;
 const rows=team(args.away,{score:args.awayScore,logo:args.away.logo,winner:winner===args.away.code})+
  team(args.home,{score:args.homeScore,logo:args.home.logo,winner:winner===args.home.code});
 return '<div class="slt-scorebug slt-scorebug-'+mode+'"><div class="slt-scorebug-top"><strong>'+headline+'</strong><span>'+subtitle+'</span></div><div class="slt-scorebug-rows">'+rows+'</div>'+
 (args.footer?'<div class="slt-scorebug-footer">'+args.footer+'</div>':'')+'</div>';
}
root.SLTScorebug={render};
if(typeof module!=='undefined')module.exports={render};
})(typeof window!=='undefined'?window:globalThis);

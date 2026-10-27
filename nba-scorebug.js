/* One newspaper scorebug standard. First row AWAY, second row HOME. */
(function(root){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const colors={"ATL":"#E03A3E","BOS":"#007A33","BKN":"#242424","CHA":"#1D1160","CHI":"#CE1141","CLE":"#860038","DAL":"#00538C","DEN":"#0E2240","DET":"#C8102E","GSW":"#1D428A","HOU":"#CE1141","IND":"#002D62","LAC":"#C8102E","LAL":"#552583","MEM":"#5D76A9","MIA":"#98002E","MIL":"#00471B","MIN":"#0C2340","NOP":"#0C2340","NYK":"#006BB6","OKC":"#007AC1","ORL":"#0077C0","PHI":"#006BB6","PHX":"#1D1160","POR":"#E03A3E","SAC":"#5A2D81","SAS":"#000000","TOR":"#CE1141","UTA":"#002B5C","WAS":"#002B5C"};
const color=t=>colors[String(t.code||'').toUpperCase()]||'#3b414b';
function team(t,opts={}){
 const score=opts.score;
 const normalized=String(t.code||'').toUpperCase();
 const espnCodes={NYK:'ny',UTA:'utah',WAS:'wsh',NOP:'no',GSW:'gs',SAS:'sa'};
 const logoUrl=opts.logo||(colors[normalized]?'https://a.espncdn.com/i/teamlogos/nba/500/'+(espnCodes[normalized]||normalized.toLowerCase())+'.png':'');
const nbaPrimaryIds={"ATL":1610612737,"BOS":1610612738,"BKN":1610612751,"CHA":1610612766,"CHI":1610612741,"CLE":1610612739,"DAL":1610612742,"DEN":1610612743,"DET":1610612765,"GSW":1610612744,"HOU":1610612745,"IND":1610612754,"LAC":1610612746,"LAL":1610612747,"MEM":1610612763,"MIA":1610612748,"MIL":1610612749,"MIN":1610612750,"NOP":1610612740,"NYK":1610612752,"OKC":1610612760,"ORL":1610612753,"PHI":1610612755,"PHX":1610612756,"POR":1610612757,"SAC":1610612758,"SAS":1610612759,"TOR":1610612761,"UTA":1610612762,"WAS":1610612764};
const logo=c=>'https://cdn.nba.com/logos/nba/'+(nbaPrimaryIds[String(c||'').toUpperCase()]||1610612737)+'/primary/L/logo.svg';
 return '<div class="slt-scorebug-team '+(opts.winner?'is-winner':'')+'" style="--team-color:'+color(t)+'"><span class="slt-scorebug-identity">'+logo+'<span><b>'+esc(t.code)+'</b><small>'+esc(t.name||t.code)+'</small>'+(t.record?'<small class="slt-scorebug-record">'+esc(t.record)+'</small>':'')+'</span></span><span class="slt-scorebug-number">'+(score===undefined||score===null?'—':esc(score))+'</span></div>';
}
function render(args){
 if(!args?.away||!args?.home)throw Error('Scorebug requires ordered away/home teams');
 const mode=['final','live','upcoming'].includes(args.mode)?args.mode:'upcoming';
 const headline=(mode==='final'?'FINAL':mode==='live'?'LIVE':'UPCOMING');
 const subtitle=args.subtitle?' · '+esc(args.subtitle):'';
 const winner=args.winner;
 if(String(args.away.code)===String(args.home.code))throw Error('Away and home teams must differ');
 const projected=Boolean(args.projected);
 if(mode==='upcoming' && !projected && (args.awayScore!=null||args.homeScore!=null))throw Error('Upcoming scorebug cannot display scores without projected=true');
 if(mode==='final'&&projected)throw Error('Final scorebug cannot contain projections');
 if(mode==='live'&&projected)throw Error('Live scorebug cannot display projected scores as live results');
 if(mode==='final'&&(args.awayScore==null||args.homeScore==null))throw Error('Final scorebug requires verified away and home scores');
 const rows=team(args.away,{score:args.awayScore,logo:args.away.logo,projected,mode,winner:winner===args.away.code})+
  team(args.home,{score:args.homeScore,logo:args.home.logo,projected,mode,winner:winner===args.home.code});
 return '<div class="slt-scorebug slt-scorebug-'+mode+'" style="--away-color:'+color(args.away)+';--home-color:'+color(args.home)+'"><div class="slt-scorebug-top"><strong>'+(projected?'PROJECTED SCORE':headline)+'</strong><span>'+subtitle+'</span></div><div class="slt-scorebug-rows">'+rows+'</div>'+
 (args.footer?'<div class="slt-scorebug-footer">'+args.footer+'</div>':'')+'</div>';
}
root.SLTScorebug={render,color:code=>color({code})};
if(typeof module!=='undefined')module.exports={render};
})(typeof window!=='undefined'?window:globalThis);

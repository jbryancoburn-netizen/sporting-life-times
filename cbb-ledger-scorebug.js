/* The Sporting Life & Times · shared college-basketball letterpress scorebug.
   One source renderer for the Daily Ledger and Courtside Desk, men and women. */
(function(root){
 'use strict';
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const color=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||''))?v:'#655239';
 // A rank shared by multiple equally rated programs must be identified as tied.
 // This uses the published rank distribution, not alphabetical tiebreakers.
 function formatRetro(profile,tieCounts,maxRank){
  const elo=Number(profile?.elo),rank=Number(profile?.rank);
  if(!profile||!Number.isFinite(elo))return 'RETRO —';
  const base='RETRO '+Math.round(elo);
  if(!Number.isInteger(rank)||rank<1||rank>maxRank)return base;
  const tied=(tieCounts?.get(rank)||0)>1;
  return base+' ('+(tied?'T-':'#')+rank+')';
 }
 function livePanel(g,label){
  const raw=String(label||'LIVE').trim();
  const halftime=/\b(?:HALF\s*TIME|HALFTIME|INTERMISSION)\b/i.test(raw);
  const clock=halftime?'':(raw.match(/\b\d{1,2}:\d{2}\b/)||[])[0]||'';
  const m=halftime?null:raw.match(/\b(?:1ST|2ND|3RD|4TH|FIRST|SECOND|THIRD|FOURTH)\s*(?:HALF|PERIOD|QUARTER)?\b|\b(?:OVERTIME|[2-9]OT|OT)\b/i);
  const period=m?m[0].trim().toUpperCase():'';
  const periods={'1ST':'FIRST HALF','2ND':'SECOND HALF','FIRST':'FIRST HALF','SECOND':'SECOND HALF',
    '3RD':'THIRD QUARTER','4TH':'FOURTH QUARTER','THIRD':'THIRD QUARTER','FOURTH':'FOURTH QUARTER','OT':'OVERTIME'};
  const womens=String(g.gender||'').toLowerCase()==='women';
  const quarters=g.periodFormat==='quarters'||womens||/\bQUARTER\b/i.test(raw);
  // NCAA women play four quarters; NCAA men play two halves.
  // ESPN shortDetail frequently sends "1st", "2nd" etc. without the unit.
  const n=(period.match(/^(?:1ST|FIRST|2ND|SECOND|3RD|THIRD|4TH|FOURTH)/)||[])[0];
  const index={'1ST':1,'FIRST':1,'2ND':2,'SECOND':2,'3RD':3,'THIRD':3,'4TH':4,'FOURTH':4}[n];
  const periodLabel=index?(quarters?['','FIRST QUARTER','SECOND QUARTER','THIRD QUARTER','FOURTH QUARTER'][index]:
    index<=2?['','FIRST HALF','SECOND HALF'][index]:['','','THIRD QUARTER','FOURTH QUARTER'][index]):
    periods[period]||period;
  // Keep the canonical period semantics, but use a compact broadcast label in the narrow status column.
  const compactPeriod=index?(quarters?index+'TH QTR':index+'TH HALF'):periodLabel;
  const displayPeriod=index?(quarters?['','1ST QUARTER','2ND QUARTER','3RD QUARTER','4TH QUARTER'][index]:['','1ST HALF','2ND HALF','3RD QTR','4TH QTR'][index]):compactPeriod;
  const momentum=g.momentum&&typeof g.momentum.text==='string'?g.momentum:null;
  if(halftime)return '<div class="ledger26-status ledger26-status--stack" data-phase="live"><strong class="ledger26-clock ledger26-clock--text">HALFTIME</strong></div>';
  const main=clock||(!periodLabel&&raw!=='LIVE'?raw:'LIVE');
  return '<div class="ledger26-status ledger26-status--stack" data-phase="live">'+
    '<strong class="ledger26-clock'+(clock?'':' ledger26-clock--text')+'">'+esc(main)+'</strong>'+
    (periodLabel?'<span class="ledger26-period" title="'+esc(periodLabel)+'" aria-label="'+esc(periodLabel)+'">'+esc(displayPeriod)+'</span>':'')+
    (momentum?'<small class="ledger26-situation ledger26-momentum'+(momentum.kind==='run'?' ledger26-momentum--run':'')+'">'+esc(momentum.text)+'</small>':'')+'</div>';
 }
 function pregamePanel(g){
  const f=g.forecast;
  if(!f||typeof f.team!=='string'||!Number.isFinite(f.probability)||f.probability<0||f.probability>1)
    return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming"><strong class="ledger26-pregame-empty">'+esc(g.time||g.tipoff||'PREGAME')+'</strong></div>';
  const team=f.team.trim(),percent=Math.round(f.probability*100);
  if(percent===50)return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming" aria-label="Even matchup: 50 percent win probability for each team; no projected favorite"><strong class="ledger26-pregame-prob">50%</strong><span class="ledger26-pregame-team">EVEN</span><span class="ledger26-pregame-caption">EACH TEAM · TOSS-UP</span></div>';
  const margin=Number.isFinite(f.margin)&&f.margin>=0.05?'+'+f.margin.toFixed(1):'';
  return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming" aria-label="'+
    esc(team+' '+percent+' percent win probability'+(margin?', RETRO projected winning margin '+margin+' points':''))+'">'+
    '<strong class="ledger26-pregame-prob">'+percent+'%</strong>'+
    '<span class="ledger26-pregame-team" title="'+esc(team)+'">'+esc(team)+'</span>'+
    '<span class="ledger26-pregame-caption">WIN CHANCE</span>'+
    (margin?'<span class="ledger26-pregame-edge">'+margin+'</span><span class="ledger26-pregame-caption">RETRO EDGE</span>':'')+
    '</div>';
 }
 const pressCache=new Map();
 const pressGender=g=>String(g.gender||(typeof document!=='undefined'?document.body?.dataset?.gender:'')||((typeof location!=='undefined'?new URLSearchParams(location.search).get('gender'):''))||'men').toLowerCase().includes('wom')?'women':'men';
 function pressNames(team){
  const full=String(team?.name||'').trim();
  const mascots=/\b(?:Wildcats|Hoosiers|Bulldogs|Tigers|Bears|Eagles|Huskies|Panthers|Cardinals|Spartans|Aggies|Cowboys|Cougars|Redhawks|Broncos|Falcons|Terriers|Hawkeyes|Cornhuskers|Gators|Seminoles|Buckeyes|Wolverines|Pirates|Knights|Ducks|Bruins|Trojans|Mountaineers|Rams|Deacons|Rebels|Blue Devils|Tar Heels|Crimson Tide)\b/gi;
  const short=full.replace(mascots,'').trim();
  return [...new Set([full,short,team?.shortName].filter(Boolean).map(x=>String(x).trim().toLowerCase()).filter(x=>x.length>=4))];
 }
 function exactMention(txt,term){return new RegExp('(^|[^a-z])'+term.replace(/[^a-z0-9 ]/gi,'').replace(/ +/g,'\\s+')+'(?=$|[^a-z])','i').test(txt)}
 async function pressArticles(g){
  const gender=pressGender(g);
  const paths=gender==='women'?['data/cbb-women-front-news.json','data/cbb-national-news.json','articles.json']:['data/cbb-men-front-news.json','data/cbb-national-news.json','articles.json'];
  const key=gender;
  let promise=pressCache.get(key);
  if(!promise){
   promise=Promise.all(paths.map(async path=>{try{const response=await fetch(path+'?press='+Math.floor(Date.now()/300000),{cache:'no-store'});if(!response.ok)return [];const data=await response.json();return Array.isArray(data.articles)?data.articles:[]}catch{return []}})).then(groups=>groups.flat());
   pressCache.set(key,promise);
   setTimeout(()=>pressCache.delete(key),300000);
  }
  const articles=await promise;
  const namesA=pressNames(g.away),namesH=pressNames(g.home),now=Date.now(),seen=new Set();
  const matched=articles.flatMap(a=>{
   if(!a.title||!a.url||!a.source)return [];
   if(gender==='women'&&a.gender==='men'||gender==='men'&&a.gender==='women')return [];
   let url;try{url=new URL(a.url,location.href);if(!/^https?:$/.test(url.protocol))return []}catch{return []}
   const when=Date.parse(a.published_at||'');if(!Number.isFinite(when)||when>now+86400000||now-when>14*86400000)return [];
   if(/\\b(recap|postgame|post-game|final score|defeats|defeated|beats|beat|highlights|odds|betting|parlay)\\b/i.test(a.title))return [];
   const content=String(a.title||'')+' '+String(a.summary||'');
   const away=namesA.some(x=>exactMention(content,x)),home=namesH.some(x=>exactMention(content,x));
   if(!away&&!home)return [];
   const pregame=/\\b(preview|pregame|pre-game|matchup|game notes|scouting|versus|vs\\.?|faces|hosts|travels to|set to face|takes on|ahead of)\\b/i.test(content);
   const id=url.href;if(seen.has(id))return [];seen.add(id);
   if(away&&home&&pregame)return [{...a,pressType:'matchup',pressRank:3}];
   if(pregame)return [{...a,pressType:'team',pressRank:2}];
   return [{...a,pressType:'background',pressRank:1}];
  }).sort((a,b)=>b.pressRank-a.pressRank||Date.parse(b.published_at)-Date.parse(a.published_at));
  return matched.slice(0,6);
 }
 function preview(g){
  const away=g.away||{},home=g.home||{};
  const match=(away.name||'Away')+' at '+(home.name||'Home');
  const when=[g.date,g.tipoff||g.time,g.venue||g.arena,g.network||g.tv].filter(Boolean).map(esc).join(' · ');
  return '<button type="button" class="ledger26-preview-link" data-slt-preview-open data-slt-press-away="'+esc(away.name||'')+'" data-slt-press-home="'+esc(home.name||'')+'" data-slt-press-gender="'+esc(pressGender(g))+'" aria-label="Read pregame press for '+esc(match)+'">PREGAME PRESS ›</button>'+
   '<dialog class="ledger26-preview-dialog" aria-label="Pregame press: '+esc(match)+'" data-slt-press-away="'+esc(away.name||'')+'" data-slt-press-home="'+esc(home.name||'')+'" data-slt-press-gender="'+esc(pressGender(g))+'"><div class="ledger26-preview-paper">'+
   '<div class="ledger26-preview-heading"><span>SPORTING LIFE &amp; TIMES · FROM THE PRESS BOX</span><button type="button" data-slt-preview-close aria-label="Close pregame press">×</button></div>'+
   '<h2>'+esc(match)+'</h2>'+(when?'<p class="ledger26-preview-meta">'+when+'</p>':'')+
   '<h3>THE PREGAME PRESS</h3><div class="ledger26-press-stories" aria-live="polite"><p>Checking published matchup coverage…</p></div>'+
   '<p class="ledger26-preview-note">Original reporting remains with its publisher. Headlines link to the source; no articles are fabricated.</p>'+
   '</div></dialog>';
 }
 async function loadPress(dialog){
  const target=dialog?.querySelector('.ledger26-press-stories');if(!target)return;
  target.innerHTML='<p>Checking published matchup coverage…</p>';
  try{
   const game={away:{name:dialog.dataset.sltPressAway},home:{name:dialog.dataset.sltPressHome},gender:dialog.dataset.sltPressGender};
   const articles=await pressArticles(game);
   if(!dialog.open)return;
   if(!articles.length){target.innerHTML='<p class="ledger26-preview-unavailable">No verified matchup-specific pregame articles are currently available in the newspaper wire. New coverage will appear here as the feed updates.</p>';return}
   target.innerHTML=articles.map(a=>{
    const href=esc(new URL(a.url,location.href).href);
    const date=new Date(a.published_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    return '<article class="ledger26-press-story"><small>'+esc(a.pressType==='matchup'?'MATCHUP PREVIEW':a.pressType==='team'?'TEAM PREGAME COVERAGE':'TEAM REPORTING')+' · '+esc(a.source)+' · '+esc(date)+'</small><a href="'+href+'" target="_blank" rel="noopener noreferrer">'+esc(a.title)+'</a></article>';
   }).join('');
  }catch{target.innerHTML='<p class="ledger26-preview-unavailable">The pregame news wire is temporarily unavailable.</p>'}
 }
 if(typeof document!=='undefined'&&!document.__sltPreviewClickBound){
  document.__sltPreviewClickBound=true;
  document.addEventListener('click',function(e){
   const open=e.target.closest('[data-slt-preview-open]');
   if(open){
    e.preventDefault();e.stopImmediatePropagation();
    let dialog=open.closest('.ledger26-scorebug')?.querySelector('.ledger26-preview-dialog');
    if(!dialog){
     const temp=document.createElement('div');
     temp.innerHTML=preview({gender:open.dataset.sltPressGender,away:{name:open.dataset.sltPressAway},home:{name:open.dataset.sltPressHome}});
     dialog=temp.querySelector('dialog');
    }
    if(dialog&&typeof dialog.showModal==='function'){
     // Dialog must be outside expandable scorecard summaries to avoid native summary clipping/toggling.
     document.body.appendChild(dialog);
     dialog.showModal();loadPress(dialog)
    }
    return;
   }
   const close=e.target.closest('[data-slt-preview-close]');
   if(close){e.preventDefault();e.stopPropagation();close.closest('dialog')?.close();}
  },true);
 }
 function render(input){
  const g=input||{},phase=['live','final','upcoming'].includes(g.phase)?g.phase:'upcoming';
  const label=(phase==='final'?
    (/^FINAL(?:\s*\/\s*OT|\s*\(OT\)|\s+AFTER\s+EXTRA\s+TIME)?$/i.test(String(g.status||''))?g.status:'FINAL'):
    phase==='upcoming'?([g.tipoff||g.time,g.network||g.tv].filter(Boolean).join(' · ')):g.status||'LIVE');
  const team=t=>{
   const x=t||{},poll=x.poll||null;
   const pollText=poll?[poll.coaches??'NR',poll.ap??'NR'].join('/'):'';
   const pollTitle=poll?'Coaches '+(poll.coaches?'#'+poll.coaches:'unranked')+' / AP '+(poll.ap?'#'+poll.ap:'unranked'):'';
   const badge=pollText?'<span class="ledger26-poll" title="'+esc(pollTitle)+'" aria-label="'+esc(pollTitle)+'">'+esc(pollText)+'</span>':'';
   const scored=phase==='upcoming'?'—':x.score==null?'—':String(x.score);
   const context=[x.record||'0–0',x.retro||'RETRO —'].join(' · ');
   return '<div class="ledger26-team" style="--ledger26-school:'+color(x.color)+'">'+
    '<span class="ledger26-crest">'+(x.crest||'')+'</span>'+
    '<span class="ledger26-identity"><strong class="ledger26-name">'+badge+esc(x.name||'School')+'</strong>'+
    '<small class="ledger26-record">'+esc(context)+'</small></span>'+
    '<b class="ledger26-points">'+esc(scored)+'</b></div>';
  };
  return '<div class="ledger26-scorebug" role="group" aria-label="'+esc(g.ariaLabel||((g.away?.name||'Away')+' at '+(g.home?.name||'Home')+' scoreboard'))+'">'+
    '<span class="ledger26-monogram"><img src="assets/slt-engraved-black.svg" width="35" height="49" alt="Sporting Life and Times monogram"></span>'+
    '<div class="ledger26-teams">'+team(g.away)+team(g.home)+'</div>'+
    (phase==='live'?livePanel(g,label):phase==='upcoming'?pregamePanel(g):label?'<div class="ledger26-status" data-phase="'+phase+'"><strong>'+esc(label)+'</strong></div>':'')+(phase==='upcoming'?preview(g):'')+'</div>';
 }
 // The Daily Ledger is the universal newspaper model, not a separate sport skin.
 // Keep the old alias for existing college basketball pages.
 function openPress(g){
  const shell=document.createElement('div');shell.innerHTML=preview({...g,phase:'upcoming'});
  const dialog=shell.querySelector('dialog');if(!dialog)return;
  document.body.appendChild(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();loadPress(dialog);
 }
 root.SLTSportsScorebug={render,formatRetro,openPress,version:'shared-letterpress-v14-robust-dialog'};
 root.SLTBasketballScorebug=root.SLTSportsScorebug;
})(typeof window!=='undefined'?window:globalThis);

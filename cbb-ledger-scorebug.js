/* The Sporting Life & Times · shared college-basketball letterpress scorebug.
   Rich embossed edition: shared men's/women's release with refreshed CI asset contract.
   One source renderer for the Daily Ledger and Courtside Desk, men and women. */
(function(root){
 'use strict';
 const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const color=v=>/^#[0-9a-fA-F]{6}$/.test(String(v||''))?v:'#655239';
 // Select ink against the ACTUAL blended panel, not the school's raw color.
 const channels=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 const blend=(a,b,p)=>channels(color(a)).map((v,i)=>v*p+channels(b)[i]*(1-p));
 const lum=c=>c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 const readableInk=(school,phase,outcome)=>{
  const background=phase==='upcoming'?blend(school,'#ffffff',.88):
   outcome==='behind'?blend(school,'#f5e9d0',.38):
   outcome==='ahead'?blend(school,'#17100d',.87):blend(school,'#ffffff',.85);
  const light='#fffaf0',dark='#201911',b=lum(background),l=lum(channels(light)),d=lum(channels(dark));
  return (Math.max(l,b)+.05)/(Math.min(l,b)+.05)>=(Math.max(d,b)+.05)/(Math.min(d,b)+.05)?light:dark;
 };
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
  const main=clock||'CLOCK UNAVAILABLE';
  return '<div class="ledger26-status ledger26-status--stack" data-phase="live">'+
    '<strong class="ledger26-clock'+(clock?'':' ledger26-clock--text')+'">'+esc(main)+'</strong>'+
    '<span class="ledger26-period" title="'+esc(periodLabel||'Period not supplied by live source')+'" aria-label="'+esc(periodLabel||'Period unavailable')+'">'+esc(displayPeriod||'PERIOD UNAVAILABLE')+'</span>'+
    (momentum?'<small class="ledger26-situation ledger26-momentum'+(momentum.kind==='run'?' ledger26-momentum--run':'')+'">'+esc(momentum.text)+'</small>':'')+'</div>';
 }
 function pregamePanel(g){
  // A disputed source must never be presented as a confident forecast.
  if(/\b(?:SOURCE CONFLICT|REVIEW|DISPUTED)\b/i.test(String(g.status||'')))
    return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming"><strong>'+esc(g.status)+'</strong></div>';
  const f=g.forecast;
  if(!f||typeof f.team!=='string'||!Number.isFinite(f.probability)||f.probability<0||f.probability>1)
    return '<div class="ledger26-status ledger26-status--pregame" data-phase="upcoming"><strong class="ledger26-pregame-empty">'+esc(g.suppressTipoffFallback?'NO FORECAST':(g.time||g.tipoff||'PREGAME'))+'</strong></div>';
  const team=f.team.trim(),percent=Math.round(f.probability*100);
  const halfPoint=Number.isFinite(f.margin)?Math.round(Math.abs(f.margin)*2)/2:null;
  // Negative is the favorite's basketball point spread, not a negative win margin.
  const spread=halfPoint!==null&&halfPoint>0?'−'+halfPoint.toFixed(1):'';
  const scores=Number.isFinite(f.projectedAwayScore)&&Number.isFinite(f.projectedHomeScore)&&
    f.projectedAwayScore>=0&&f.projectedHomeScore>=0;
  const awayScore=scores?Math.round(f.projectedAwayScore):null;
  const homeScore=scores?Math.round(f.projectedHomeScore):null;
  const description=team+' '+percent+' percent RETRO win probability'+
    (spread?', RETRO favorite spread '+spread+' points':'')+
    (scores?', projected final '+String(g.away?.name||'away')+' '+awayScore+', '+String(g.home?.name||'home')+' '+homeScore:'');
  // All three forecast metrics have a full-width row, including on small phones.
  // No numeric value shares a cramped side-by-side row with its label.
  return '<div class="ledger26-status ledger26-status--pregame ledger26-status--compact" data-phase="upcoming" aria-label="'+esc(description)+'">'+
   '<div class="ledger26-pregame-inline ledger26-pregame-inline--prob">'+
    '<strong class="ledger26-pregame-prob">'+percent+'%</strong>'+
    '<span class="ledger26-pregame-team" title="'+esc(team)+'">'+esc(percent===50?'EVEN':team)+'</span></div>'+
   (spread?'<div class="ledger26-pregame-inline ledger26-pregame-inline--margin">'+
    '<strong class="ledger26-pregame-edge">'+spread+'</strong>'+
    '<span class="ledger26-pregame-caption">RETRO SPREAD</span></div>':'')+
   (scores?'<div class="ledger26-pregame-inline ledger26-pregame-inline--score">'+
    '<strong class="ledger26-pregame-score">'+awayScore+'–'+homeScore+'</strong>'+
    '<span class="ledger26-pregame-caption">PROJECTED FINAL</span></div>':'')+
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
  const paths=gender==='women'?['data/cbb-women-front-news.json','data/cbb-national-news.json','data/mbb-live.json','articles.json']:['data/cbb-men-pregame-press-2026-27.json','data/cbb-men-front-news.json','data/cbb-national-news.json','data/mbb-live.json','articles.json'];
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
   if((gender==='women'&&(a.gender==='men'||a.category==='MBB'))||(gender==='men'&&(a.gender==='women'||a.category==='WBB')))return [];
   let url;try{url=new URL(a.url,location.href);if(!/^https?:$/.test(url.protocol))return []}catch{return []}
   const when=Date.parse(a.published_at||'');if(!Number.isFinite(when)||when>now+86400000||now-when>14*86400000)return [];
   if(/\b(recap|postgame|post-game|final score|defeats|defeated|beats|beat|highlights|odds|betting|parlay)\b/i.test(a.title))return [];
   // Official school-authored previews must be attributed to one of the actual opponents.
   // Do not mistake East Texas A&M coverage for the University of Texas, etc.
   if(a.origin==='official-school-athletics'&&a.school){
    const schoolKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    const publishedSchool=schoolKey(a.school);
    if(![g.away?.name,g.home?.name].some(n=>schoolKey(n)===publishedSchool))return [];
   }
   const content=String(a.title||'')+' '+String(a.summary||'')+' '+String(a.school||'');
   const away=namesA.some(x=>exactMention(content,x)),home=namesH.some(x=>exactMention(content,x));
   if(!away&&!home)return [];
   const pregame=a.origin==='official-school-athletics'||/\b(preview|pregame|pre-game|matchup|game notes|scouting|versus|vs\.?|faces|hosts|host|welcome|against|travels to|set to face|takes on|ahead of)\b/i.test(content);
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
 if(typeof document!=='undefined'&&typeof document.addEventListener==='function'&&!document.__sltPreviewClickBound){
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
     dialog.addEventListener('close',()=>dialog.remove(),{once:true});
     dialog.showModal();loadPress(dialog)
    }
    return;
   }
   const close=e.target.closest('[data-slt-preview-close]');
   if(close){e.preventDefault();e.stopPropagation();close.closest('dialog')?.close();}
  },true);
 }
 // Final-game RETRO desk: daily network rating changes are not per-game Elo swings.
 function finalRetroDesk(g){
  const teams=[g.away,g.home];
  const available=teams.filter(t=>t?.retroSnapshot&&Number.isFinite(Number(t.retroSnapshot.elo)));
  // Do not add an empty postgame box when ratings have not yet published.
  if(!available.length)return '';
  const line=t=>{
   const p=t?.retroSnapshot;
   if(!p||!Number.isFinite(Number(p.elo)))return '';
   const delta=p.dailyChange;
   const movement=typeof delta==='number'&&Number.isFinite(delta)?
    '<span class="ledger26-final-delta '+(delta>0?'ledger26-final-up':delta<0?'ledger26-final-down':'')+'">'+
     (delta>0?'▲ +':delta<0?'▼ −':'— ')+Math.abs(delta).toFixed(1)+'</span>':'';
   const rank=Number.isInteger(p.rank)&&p.rank>0?' · #'+p.rank:'';
   return '<span class="ledger26-final-team" title="RETRO rating and change since the previous daily snapshot, not necessarily attributable to this game">'+
    '<span class="ledger26-final-school">'+esc(t.name||'School')+'</span>'+
    '<strong class="ledger26-final-rating">'+Number(p.elo).toFixed(1)+'</strong>'+
    (movement?'<span class="ledger26-final-change">'+movement+'</span>':'')+
    (rank?'<small class="ledger26-final-standing">'+esc(rank)+'</small>':'')+'</span>';
  };
  return '<div class="ledger26-final-desk ledger26-final-desk--inline" aria-label="Current RETRO ratings and daily movement">'+
    '<span class="ledger26-final-kicker">RETRO NOW</span>'+
    '<div class="ledger26-final-pair">'+teams.map(line).filter(Boolean).join('')+'</div></div>';
 }

 // Watermark-only transparent page extraction. The original crest and source
 // PNG are never modified. Flood-fill ONLY light, neutral border-connected
 // page backgrounds: enclosed eyes, lettering and mascot details remain.
 const watermarkCache=new Map();
 function cleanWatermark(img){
  if(!img||img.dataset.watermarkCleaned)return;
  img.dataset.watermarkCleaned='1';
  const url=img.currentSrc||img.src||'';
  if(watermarkCache.has(url)){const cached=watermarkCache.get(url);if(cached)img.src=cached;return;}
  try{
   const w=img.naturalWidth,h=img.naturalHeight;
   if(!w||!h)return;
   const scale=Math.min(1,512/Math.max(w,h));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return;
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const frame=ctx.getImageData(0,0,canvas.width,canvas.height);
   const px=frame.data,W=canvas.width,H=canvas.height;
   const corners=[0,W-1,(H-1)*W,H*W-1],rgba=i=>[px[i*4],px[i*4+1],px[i*4+2],px[i*4+3]];
   const values=corners.map(rgba);
   if(values.some(c=>c[3]<242))return; // already transparent corner
   const bg=[0,1,2].map(k=>Math.round(values.reduce((a,c)=>a+c[k],0)/4));
   const distance=c=>Math.max(...[0,1,2].map(k=>Math.abs(c[k]-bg[k])));
   // Do not remove strong school-colored or dark archival backgrounds.
   if(Math.min(...bg)<175||Math.max(...bg)-Math.min(...bg)>49||values.some(c=>distance(c)>30))return;
   const seen=new Uint8Array(W*H),queue=new Int32Array(W*H);let head=0,tail=0;
   function add(i){
    if(seen[i])return;
    const j=i*4,delta=Math.max(Math.abs(px[j]-bg[0]),Math.abs(px[j+1]-bg[1]),Math.abs(px[j+2]-bg[2]));
    if(px[j+3]<190||delta>38)return;
    seen[i]=1;queue[tail++]=i;
   }
   for(let x=0;x<W;x++){add(x);add((H-1)*W+x);}
   for(let y=0;y<H;y++){add(y*W);add(y*W+W-1);}
   while(head<tail){
    const i=queue[head++],x=i%W,y=(i/W)|0;
    if(x>0)add(i-1);if(x+1<W)add(i+1);if(y>0)add(i-W);if(y+1<H)add(i+W);
   }
   // A light page must occupy some meaningful edge-connected area.
   if(tail<W*H*.015)return;
   for(let i=0;i<W*H;i++)if(seen[i])px[i*4+3]=0;
   // Anti-alias the newly transparent edge, without removing internal artwork.
   for(let i=0;i<W*H;i++){
    if(seen[i])continue;
    const x=i%W,y=(i/W)|0;
    if((x>0&&seen[i-1])||(x+1<W&&seen[i+1])||(y>0&&seen[i-W])||(y+1<H&&seen[i+W])){
     const j=i*4,d=Math.max(Math.abs(px[j]-bg[0]),Math.abs(px[j+1]-bg[1]),Math.abs(px[j+2]-bg[2]));
     if(d<65)px[j+3]=Math.min(px[j+3],Math.round(255*Math.max(0,(d-24)/41)));
    }
   }
   ctx.putImageData(frame,0,0);
   const cleaned=canvas.toDataURL('image/png');
   if(watermarkCache.size<300)watermarkCache.set(url,cleaned);
   img.src=cleaned;
  }catch(e){ // remote hosts without CORS remain unchanged, not broken
   img.dataset.watermarkAudit='cannot-read-source';
  }
 }


 // RETRO Pulse is an evidence-backed scoring trace, not a simulated graph.
 const pulseCache=new Map(),pulseScale=new Map(),pulseBounds=new Map();
 const sec=v=>{const m=String(v||'').match(/^(\d{1,2}):(\d\d)$/);return m?Number(m[1])*60+Number(m[2]):null;};
 const pulseRange=n=>n<=5?5:n<=10?10:Math.max(20,Math.ceil(n/10)*10);
 function pulseShell(g,phase,label){
  // A final score is already prominently displayed by the two team rows.
  // Keep only a narrow, stable status divider; no big FINAL tile or async Pulse.
  if(phase==='final'){
   const a=Number(g.away?.score),h=Number(g.home?.score);
   const valid=g.away?.score!=null&&g.home?.score!=null&&Number.isFinite(a)&&Number.isFinite(h);
   const winner=valid&&a!==h?(a>h?g.away?.name:g.home?.name):'';
   const margin=valid?Math.abs(a-h):null;
   return '<div class="ledger26-pulse ledger26-pulse--final-line" role="status" aria-label="Final score">'+
    '<span class="ledger26-final-line-label">FINAL</span>'+
    (winner?'<span class="ledger26-final-line-margin">'+esc(winner)+' by '+margin+'</span>':'')+
    '</div>';
  }
  if(g.pulseManagedExternally||phase==='upcoming'||!g.gameId||!['men','women'].includes(g.gender)||!g.away?.id||!g.home?.id)return '';
  return '<div class="ledger26-pulse" data-retro-pulse="'+esc(g.gameId)+'" data-away-name="'+esc(g.away.name)+'" data-home-name="'+esc(g.home.name)+'" data-gender="'+g.gender+
   '" data-away="'+esc(g.away.id)+'" data-home="'+esc(g.home.id)+'" data-phase="'+phase+'" data-compact-only="'+(g.pulseCompactOnly?'1':'0')+
   '" data-live-status="'+esc(label||g.status||'LIVE')+'" data-away-score="'+esc(g.away.score??'')+'" data-home-score="'+esc(g.home.score??'')+'">'+
   '<div class="ledger26-pulse-heading"><strong>'+esc(phase==='final'?'FINAL':('LIVE · '+label))+
   '</strong><span>RETRO PULSE · SCORING HISTORY PENDING</span></div></div>';
 }
 function liveStatusParts(el){
  if(el.dataset.phase!=='live')return {clock:'',period:'',halftime:false};
  const status=String(el.dataset.liveStatus||'').trim();
  const halftime=/\b(?:halftime|half\s*time|intermission)\b/i.test(status);
  if(halftime)return {clock:'',period:'',halftime:true};
  const clock=(status.match(/\b\d{1,2}:\d{2}\b/)||[])[0]||'';
  const match=status.match(/\b(?:1st|2nd|3rd|4th)(?:\s+(?:half|quarter|period))?\b|\b(?:OT|[2-9]OT|overtime)\b/i);
  const word=String(match?.[0]||'').toLowerCase();
  const period=/overtime|\bot\b|[2-9]ot/.test(word)?word.toUpperCase():
   /^[1-4]/.test(word)?word[0]+(el.dataset.gender==='women'?'Q':'H'):'';
  return {clock,period,halftime:false};
 }
 function liveStatusHTML(el){
  const {clock,period,halftime}=liveStatusParts(el);
  return '<span class="ledger26-pulse-status"><strong class="ledger26-pulse-state">'+(halftime?'HALFTIME':'LIVE')+'</strong>'+
   (!halftime?'<small class="ledger26-pulse-clock">'+esc([period||'PERIOD UNAVAILABLE',clock||'CLOCK UNAVAILABLE'].join(' · '))+'</small>':'')+'</span>';
 }
 // Label scorers from the exact game's sourced roster; no guessed player identity.
 function pulseScorerLabel(raw,el){
  const teams=new Map([[String(el.dataset.away),String(el.dataset.awayName||'Away')],
    [String(el.dataset.home),String(el.dataset.homeName||'Home')]]);
  const playerTeams=new Map();
  const add=(athlete,team)=>{
   if(!athlete||!team)return;
   for(const name of [athlete.displayName,athlete.fullName]){
    const label=String(name||'').trim();
    if(!label.includes(' '))continue;
    const key=label.toLocaleLowerCase();
    if(playerTeams.has(key)&&playerTeams.get(key)!==team)playerTeams.set(key,null);
    else if(!playerTeams.has(key))playerTeams.set(key,team);
   }
  };
  for(const group of raw?.boxscore?.players||[]){
   const team=teams.get(String(group.team?.id));
   if(team)for(const section of group.statistics||[])
    for(const item of section.athletes||[])add(item.athlete,team);
  }
  for(const group of raw?.rosters||[]){
   const team=teams.get(String(group.team?.id));
   if(team)for(const item of group.roster||group.athletes||[])add(item.athlete||item,team);
  }
  const names=[...playerTeams.entries()].filter(([,team])=>team)
    .map(([name])=>name).sort((a,b)=>b.length-a.length);
  const quote=v=>v.replace(/[^a-z0-9 ]/gi,'').replace(/ +/g,'\\s+');
  const re=names.length?new RegExp('(^|[^\\p{L}\\p{N}])('+names.map(quote).join('|')+')(?=$|[^\\p{L}\\p{N}])','giu'):null;
  return play=>{
   const desc=String(play.text||'');
   if(!re)return desc;
   return desc.replace(re,(whole,prefix,player)=>{
    const team=playerTeams.get(player.toLocaleLowerCase());
    return team?prefix+player+' ('+team+')':whole;
   });
  };
 }
 function pulseBuild(raw,el){
  const rivals=raw?.header?.competitions?.[0]?.competitors||[];
  if(String(rivals.find(x=>x.homeAway==='away')?.team?.id)!==el.dataset.away||
     String(rivals.find(x=>x.homeAway==='home')?.team?.id)!==el.dataset.home)return null;
  const source=root.SLTCourt;if(!source?.parsePlays||!source?.verifyPlayScores)return null;
  const plays=source.parsePlays(raw);
  const scorerLabel=pulseScorerLabel(raw,el);
  const audit=source.verifyPlayScores(plays,{phase:el.dataset.phase,
   away:{score:Number(el.dataset.awayScore)},home:{score:Number(el.dataset.homeScore)}});
  if(!audit.ok)return null;
  const interval=el.dataset.gender==='women'?600:1200;
  const clock=p=>{const c=sec(p.clock),period=Number(p.period);return c===null||period<1||period>8?null:(period-1)*interval+interval-c;};
  const points=[{time:0,awayScore:0,homeScore:0,period:1,clock:'',text:''}];
  for(const p of audit.sequence){const t=clock(p);if(t===null||t<points.at(-1).time)continue;points.push({...p,time:t,scorerLabel:scorerLabel(p)});}
  if(points.length<3)return null;
  const duration=points.at(-1).time;
  const breaks=[];
  for(let n=1;n<=8;n++)if(n*interval<duration-1)
   breaks.push({time:n*interval,label:el.dataset.gender==='women'?'Q'+n:(n===1?'HT':'PERIOD '+n),kind:'period'});
  for(const p of plays){
   const t=clock(p),line=String(p.kind||'')+' '+String(p.text||'');
   if(t===null||t<=0||t>=duration||!/time[\s-]*out/i.test(line))continue;
   const media=/media|official|television|tv timeout/i.test(line);
   if(!media)continue; // team timeouts belong to the full gamefile
   const remaining=sec(p.clock);
   const band=remaining===null?null:Math.min(el.dataset.gender==='women'?8:16,Math.max(4,Math.ceil(remaining/240)*4));
   // U16 is a named break category; the exact stoppage clock is always recorded.
   const label=(band?'U'+band:'MEDIA')+' · '+String(p.clock||'');
   if(!breaks.some(b=>Math.abs(t-b.time)<8))breaks.push({time:t,label,kind:'media',clock:p.clock});
  }
  breaks.sort((a,b)=>a.time-b.time);
  const edges=[{time:0,label:'TIP'},...breaks,{time:duration,label:el.dataset.phase==='final'?'FINAL':'LATEST'}];
  const spans=edges.slice(1).map((edge,i)=>{
   const start=edges[i],before=[...points].reverse().find(p=>p.time<=start.time)||points[0];
   const after=[...points].reverse().find(p=>p.time<=edge.time)||before;
   return {start,end:edge,away:after.awayScore-before.awayScore,home:after.homeScore-before.homeScore,
    plays:points.filter(p=>p.time>start.time&&p.time<=edge.time&&p.scoring)};
  }).filter(s=>s.end.time>s.start.time);
  return {points,breaks,spans,duration,away:rivals.find(x=>x.homeAway==='away')?.team?.shortDisplayName||'AWAY',
   home:rivals.find(x=>x.homeAway==='home')?.team?.shortDisplayName||''};
 }
 function pulseDraw(el,data){
  const id=el.dataset.gender+':'+el.dataset.retroPulse;
  const awayName=el.dataset.awayName||data.away,homeName=el.dataset.homeName||data.home;
  const margins=data.points.map(p=>p.awayScore-p.homeScore);
  const maxLead=Math.max(0,...margins),minLead=Math.min(0,...margins);
  const scale=Math.max(pulseScale.get(id)||5,pulseRange(Math.max(maxLead,-minLead)));
  pulseScale.set(id,scale); // The full-game maximum never shrinks after a comeback.
  const largest=maxLead>=-minLead?{name:awayName,value:maxLead}:{name:homeName,value:-minLead};
  const last=data.points.at(-1),diff=last.awayScore-last.homeScore;
  const current=diff===0?'TIED':(diff>0?awayName:homeName)+' +'+Math.abs(diff);
  const heading=el.querySelector('.ledger26-pulse-heading strong')?.textContent||'FINAL';
  const liveParts=liveStatusParts(el);
  const liveClock=liveParts.clock;
  const livePeriod=liveParts.period;
  const compactHeading=liveParts.halftime?'HALFTIME':el.dataset.phase==='live'?'LIVE':heading;
  // Concept A: a readable score summary, not a tiny line pretending to explain a game.
  el.innerHTML='<div class="ledger26-pulse-compact" aria-label="RETRO Pulse quick summary">'+
   '<span class="ledger26-pulse-status"><strong class="ledger26-pulse-state">'+esc(compactHeading)+'</strong>'+(liveClock||livePeriod?'<small class="ledger26-pulse-clock">'+esc([livePeriod,liveClock].filter(Boolean).join(' · '))+'</small>':'')+'</span>'+
   '<div class="ledger26-pulse-stat"><small>BIGGEST LEAD · '+esc(largest.name)+'</small><b>+'+largest.value+'</b></div>'+
   '<div class="ledger26-pulse-stat"><small>'+(el.dataset.phase==='final'?'FINAL MARGIN':'CURRENT LEAD')+(diff===0?'':(' · '+esc(diff>0?awayName:homeName)))+'</small><b>'+(diff===0?'TIED':('+'+Math.abs(diff)))+'</b></div>'+
   '<span class="ledger26-pulse-invite">'+(el.dataset.compactOnly==='1'?'OPEN GAME DETAILS':'GAME FLOW')+' <span aria-hidden="true">⌄</span></span></div>';
  pulseCache.set(el,data);
  // The ledger retains its compact scorebug rail, while its separate color Gamefile owns the only full game-flow chart.
  if(el.dataset.compactOnly==='1')return;
  const details=el.closest('details'),target=details?.querySelector('.ledger26-expanded');
  if(!target)return;
  // Concept B: the full graph is only in the expanded gamefile, where it has room.
  // Linear and zero-anchored, but asymmetric: a +40/−2 game uses −5..+40,
  // not a visually misleading, wasteful symmetric −40..+40.
  const bounds=pulseBounds.get(id)||{min:0,max:0};
  const floor=Math.min(bounds.min,Math.floor(minLead/5)*5);
  const ceil=Math.max(bounds.max,Math.ceil(maxLead/5)*5);
  const bottom=Math.min(0,floor),top=Math.max(5,ceil);
  pulseBounds.set(id,{min:bottom,max:top}); // Never shrink either bound.
  const left=61,right=902,upper=38,lower=222;
  const x=t=>left+(right-left)*t/Math.max(1,data.duration);
  const y=margin=>lower-(margin-bottom)/(top-bottom)*(lower-upper);
  const path=data.points.map((p,i)=>{
   const xx=x(p.time).toFixed(1),yy=y(p.awayScore-p.homeScore).toFixed(1);
   return i?'H'+xx+' V'+yy:'M'+xx+' '+yy;
  }).join(' ');
  const step=top-bottom>45?10:top-bottom>20?5:top-bottom>10?2:1;
  const ticks=[];
  for(let v=Math.ceil(bottom/step)*step;v<=top;v+=step){
   ticks.push('<line x1="'+left+'" x2="'+right+'" y1="'+y(v).toFixed(1)+'" y2="'+y(v).toFixed(1)+'" class="ledger26-pulse-rule'+(v===0?' ledger26-pulse-rule--zero':'')+'"/>'+
    '<text x="'+(left-12)+'" y="'+(y(v)+4).toFixed(1)+'" text-anchor="end" class="ledger26-pulse-axis">'+(v>0?'+':'')+v+'</text>');
  }
  const marks=data.breaks.map(b=>{
   const pos=x(b.time).toFixed(1),half=b.label==='HT';
   const lab=half?'HALFTIME':b.kind==='media'?b.label:'';
   return '<line x1="'+pos+'" x2="'+pos+'" y1="'+upper+'" y2="'+lower+'" class="ledger26-pulse-divider'+(half?' ledger26-pulse-divider--half':'')+'"/>'+
    (half?'<text x="'+pos+'" y="24" text-anchor="middle" class="ledger26-pulse-period-label">HALFTIME</text>':
     lab?'<text x="'+pos+'" y="31" text-anchor="middle" class="ledger26-pulse-media-label">'+esc(lab)+'</text>':'');
  }).join('');
  const regions=data.spans.map((span,i)=>'<button type="button" data-retro-segment="'+i+
   '" class="ledger26-pulse-hit" style="left:'+(100*span.start.time/data.duration).toFixed(2)+
   '%;width:'+Math.max(.4,100*(span.end.time-span.start.time)/data.duration).toFixed(2)+
   '%" aria-label="Scoring: '+esc(span.start.label)+' to '+esc(span.end.label)+
   '" title="'+esc(span.start.label)+' → '+esc(span.end.label)+'"></button>').join('');
  let panel=target.querySelector('.ledger26-pulse-expanded');
  if(!panel){panel=document.createElement('section');panel.className='ledger26-pulse-expanded';target.prepend(panel);}
  panel.innerHTML='<div class="ledger26-pulse-expanded-head"><strong>RETRO PULSE · GAME FLOW</strong><span>'+
   esc(awayName)+' ABOVE ZERO · '+esc(homeName)+' BELOW ZERO</span></div>'+
   '<div class="ledger26-pulse-expanded-chart"><svg viewBox="0 0 940 258" preserveAspectRatio="none" role="img" aria-label="Full game scoring margin. '+esc(awayName)+' leads above zero and '+esc(homeName)+' below. '+esc(largest.name)+' led by as many as '+largest.value+'.">'+
   ticks.join('')+marks+'<path d="'+path+'" class="ledger26-pulse-trace"/>'+
   '<circle cx="'+x(last.time).toFixed(1)+'" cy="'+y(diff).toFixed(1)+'" r="4" class="ledger26-pulse-last"/>'+
   '<text x="'+left+'" y="251" class="ledger26-pulse-time">TIPOFF</text>'+
   '<text x="'+right+'" y="251" text-anchor="end" class="ledger26-pulse-time">'+(el.dataset.phase==='final'?'FINAL':'LATEST')+'</text>'+
   '</svg><div class="ledger26-pulse-taps">'+regions+'</div></div>'+
   '<div class="ledger26-pulse-expanded-foot">PEAK '+esc(largest.name)+' +'+largest.value+
   ' · CURRENT '+esc(current)+' · FULL-GAME LEAD SCALE '+bottom+' TO +'+top+
   ' · Select any section for the scoring log</div>';
 }
 function pulseStatsFallback(raw,el){
  // Never display statistics from a different matchup; identity check first.
  const rivals=raw?.header?.competitions?.[0]?.competitors||[];
  if(String(rivals.find(x=>x.homeAway==='away')?.team?.id||'')!==el.dataset.away||
     String(rivals.find(x=>x.homeAway==='home')?.team?.id||'')!==el.dataset.home)return '';
  const teams=raw?.boxscore?.teams||[];
  const away=teams.find(t=>String(t.team?.id)===el.dataset.away);
  const home=teams.find(t=>String(t.team?.id)===el.dataset.home);
  const stat=(t,terms)=>{
   const entry=(t?.statistics||[]).find(z=>{
    const label=String(z.name||z.label||z.abbreviation||'').toLowerCase().replace(/[^a-z0-9]/g,'');
    return terms.includes(label);
   });
   return entry?.displayValue??entry?.value??null;
  };
  const rows=[
   ['REBOUNDS',['rebounds','totalrebounds']],
   ['ASSISTS',['assists']],
   ['TURNOVERS',['turnovers']],
   ['3-POINT %',['threepointfieldgoalpct','threepointfieldgoalpercentage']],
   ['FIELD GOAL %',['fieldgoalpct','fieldgoalpercentage']]
  ].flatMap(([label,keys])=>{
   const av=stat(away,keys),hv=stat(home,keys);
   return av===null&&hv===null?[]:[{label,av,hv}];
  }).slice(0,3);
  if(!rows.length){
   const period=rivals.map(t=>(t.linescores||[]).map(z=>Number(z.value??z.displayValue)));
   if(period.length===2&&period[0].length>0&&period[0].length===period[1].length&&
      period.flat().every(Number.isFinite)){
    const isAway=rivals[0].homeAway==='away',a=isAway?period[0]:period[1],h=isAway?period[1]:period[0];
    return '<div class="ledger26-pulse-quickstats">'+liveStatusHTML(el)+'<strong>SCORING BY PERIOD</strong><span>'+esc(el.dataset.awayName)+
      ' '+a.join(' / ')+' · '+esc(el.dataset.homeName)+' '+h.join(' / ')+'</span></div>';
   }
   return '';
  }
  return '<div class="ledger26-pulse-quickstats">'+liveStatusHTML(el)+'<strong>KEY STATS</strong>'+
   rows.map(v=>'<span><b>'+esc(v.label)+'</b> '+esc(el.dataset.awayName)+' '+esc(v.av??'—')+
    ' · '+esc(el.dataset.homeName)+' '+esc(v.hv??'—')+'</span>').join('')+'</div>';
 }
 function pulseRemoveEmpty(el){
  if(el.dataset.compactOnly==='1'){
   const phase=el.dataset.phase||'final';
   const away=Number(el.dataset.awayScore),home=Number(el.dataset.homeScore);
   const scoresPresent=el.dataset.awayScore!==''&&el.dataset.homeScore!==''&&Number.isFinite(away)&&Number.isFinite(home);
   const lead=scoresPresent?away-home:null;
   const leader=lead===null?'':lead>0?el.dataset.awayName:lead<0?el.dataset.homeName:'';
   el.innerHTML='<div class="ledger26-pulse-compact" aria-label="Game status and scoring summary">'+
    (phase==='live'?liveStatusHTML(el):'<strong class="ledger26-pulse-state">FINAL</strong>')+
    (lead===null?'': '<div class="ledger26-pulse-stat"><small>'+(phase==='final'?'FINAL MARGIN':'CURRENT LEAD')+(leader?' · '+esc(leader):'')+'</small><b>'+(lead===0?'TIED':'+'+Math.abs(lead))+'</b></div>')+
    '<span class="ledger26-pulse-invite">OPEN GAME DETAILS <span aria-hidden="true">⌄</span></span></div>';
   return;
  }
  const shell=el.closest('.ledger26-scorebug'),phase=el.dataset.phase||'final';
  const status=phase==='live'?(liveStatusParts(el).halftime?'HALFTIME':String(el.dataset.liveStatus||'LIVE')):(el.querySelector('.ledger26-pulse-heading strong')?.textContent||'FINAL');
  el.remove();
  if(!shell)return;
  shell.classList.remove('ledger26-scorebug--pulse');
  const bar=document.createElement('div');bar.className='ledger26-status';bar.dataset.phase=phase;
  const strong=document.createElement('strong');strong.textContent=status;bar.append(strong);shell.append(bar);
 }
 async function pulseLoad(el){
  if(el.dataset.loading||!el.isConnected)return;el.dataset.loading='1';
  const url='https://site.api.espn.com/apis/site/v2/sports/basketball/'+
   (el.dataset.gender==='women'?'womens':'mens')+'-college-basketball/summary?event='+encodeURIComponent(el.dataset.retroPulse);
  try{
   const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('summary');
   const raw=await response.json();if(!el.isConnected)return;
   const model=pulseBuild(raw,el);
   if(model){pulseDraw(el,model);return;}
   const stats=pulseStatsFallback(raw,el);
   if(stats){el.innerHTML=stats;el.classList.add('ledger26-pulse--stats');}
   else pulseRemoveEmpty(el);
  }catch{if(el.isConnected)pulseRemoveEmpty(el);}
 }
 function pulseSegmentMicrograph(model,item){
  // A separately labeled CLOSE-UP, never silently rescale the main game graph.
  const subset=model.points.filter(p=>p.time>=item.start.time&&p.time<=item.end.time);
  const before=[...model.points].reverse().find(p=>p.time<=item.start.time)||model.points[0];
  const after=[...model.points].reverse().find(p=>p.time<=item.end.time)||before;
  const series=[{...before,time:item.start.time},...subset,{...after,time:item.end.time}];
  const margins=series.map(p=>p.awayScore-p.homeScore);
  const low=Math.min(...margins),high=Math.max(...margins);
  const localScale=Math.max(2,high-low),toX=t=>22+338*(t-item.start.time)/Math.max(1,item.end.time-item.start.time);
  const toY=margin=>49-(margin-low)/localScale*35;
  const d=series.map((p,i)=>{
   const xx=toX(p.time).toFixed(1),yy=toY(p.awayScore-p.homeScore).toFixed(1);
   return i?'H'+xx+' V'+yy:'M'+xx+' '+yy;
  }).join(' ');
  const label=low===high?'Lead unchanged at '+low:'Lead range '+low+' to '+high;
  return '<div class="ledger26-pulse-closeup"><div><strong>SELECTED STRETCH · MAGNIFIED</strong><small>'+esc(label)+' points</small></div>'+
   '<svg viewBox="0 0 380 65" preserveAspectRatio="none" role="img" aria-label="Selected scoring stretch magnified; this is not the full-game lead scale">'+
   '<line x1="22" x2="360" y1="49" y2="49" stroke="#8d7655" stroke-width="1"/>'+
   '<path d="'+d+'" fill="none" stroke="#84283a" stroke-width="1.65" vector-effect="non-scaling-stroke" stroke-linejoin="miter"/>'+
   '</svg></div>';
 }
 if(root.document){
  let observer,scanQueued=false;
  const scan=()=>{
   if(!observer&&root.IntersectionObserver)observer=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);void pulseLoad(e.target);}});
   },{rootMargin:'240px'});
   for(const el of document.querySelectorAll('.ledger26-pulse:not([data-observed])')){
    el.dataset.observed='1';if(observer)observer.observe(el);else void pulseLoad(el);
   }
  };
  const queue=()=>{if(scanQueued)return;scanQueued=true;requestAnimationFrame(()=>{scanQueued=false;scan();});};
  document.addEventListener('DOMContentLoaded',()=>{
   queue();const host=document.getElementById('sl-games');
   if(host)new MutationObserver(queue).observe(host,{subtree:true,childList:true});
  });
  document.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-retro-segment]');if(!button)return;
   event.preventDefault();event.stopPropagation();
   const host=button.closest('details')?.querySelector('.ledger26-pulse'),model=pulseCache.get(host);
   const item=model?.spans[Number(button.dataset.retroSegment)];if(!item)return;
   const detail=host.closest('details'),target=detail?.querySelector('.ledger26-expanded');
   if(!detail||!target)return;
   detail.open=true;
   let panel=target.querySelector('.ledger26-pulse-breakdown');
   if(!panel){panel=document.createElement('section');panel.className='ledger26-pulse-breakdown';(target.querySelector('.ledger26-pulse-expanded')||target).after(panel);}
   if(panel.dataset.index===button.dataset.retroSegment){panel.remove();return;}
   panel.dataset.index=button.dataset.retroSegment;
   panel.innerHTML='<strong>RETRO PULSE · '+esc(item.start.label)+' TO '+esc(item.end.label)+'</strong>'+
    pulseSegmentMicrograph(model,item)+
    '<span>'+esc(host.dataset.awayName||model.away)+' '+item.away+' · '+esc(host.dataset.homeName||model.home)+' '+item.home+' points in this stretch</span>'+
    (item.plays.length?'<ol>'+item.plays.slice(0,35).map(p=>'<li>'+esc(p.clock)+' · '+esc(p.scorerLabel||p.text)+'</li>').join('')+'</ol>':
    '<small>No individual scoring events available for this interval.</small>');
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
   const side=x===g.away?'away':'home';
   const rank=t=>{const n=Number(t?.poll?.ap);return Number.isInteger(n)&&n>=1&&n<=25?n:null;};
   const ownRank=rank(x),otherRank=rank(side==='away'?g.home:g.away);
   const other=side==='away'?g.home:g.away;
   const upset=phase==='live'&&ownRank!==null&&otherRank!==null&&ownRank>otherRank&&
     Number.isFinite(Number(x.score))&&Number.isFinite(Number(other?.score))&&Number(x.score)>Number(other.score);
   const timeouts=phase==='live'&&Number.isInteger(x.timeoutsRemaining)&&x.timeoutsRemaining>=0&&x.timeoutsRemaining<=8?
     '<span class="ledger26-timeouts" title="'+x.timeoutsRemaining+' timeouts remaining" aria-label="'+x.timeoutsRemaining+' timeouts remaining">'+
       '<span class="ledger26-timeout-label">TO</span>'+Array.from({length:x.timeoutsRemaining},()=>'<i aria-hidden="true"></i>').join('')+'</span>':'';
   const possession=phase==='live'&&g.possession===side?
     '<span class="ledger26-possession" title="Possession" aria-label="Possession">◆</span>':'';
   const momentum=phase==='live'&&g.momentum?.kind==='run'&&
     Boolean(x.abbreviation||x.name)&&String(g.momentum.text||'').toUpperCase().startsWith(String(x.abbreviation||x.name||'').toUpperCase()+' ')?
     '<span class="ledger26-team-run" title="'+esc(g.momentum.text)+'" aria-label="Scoring run">↗</span>':'';
   const scoreClass=upset?' ledger26-points--upset':'';
   const context=[x.record||'0–0',x.retro||'RETRO —'].join(' · ');
   // Desktop: retain recent results and sourced scoring rates at every phase.
   const profile=x.scouting&&(Number.isInteger(x.scouting.games)&&x.scouting.games>0||Array.isArray(x.scouting.lastFive)&&x.scouting.lastFive.length>0)?x.scouting:null;
   const ppg=profile&&Number.isFinite(profile.pointsFor)?profile.pointsFor.toFixed(1):null;
   const papg=profile&&Number.isFinite(profile.pointsAgainst)?profile.pointsAgainst.toFixed(1):null;
   const form=profile&&Array.isArray(profile.lastFive)?profile.lastFive.filter(v=>
     v==='W'||v==='L'||(v&&typeof v==='object'&&(v.result==='W'||v.result==='L'))):[];
   const outcomes=form.map(v=>typeof v==='string'?v:v.result);
   const finalForm=outcomes.at(-1),streak=finalForm?outcomes.slice().reverse().findIndex(v=>v!==finalForm):-1;
   const streakLength=streak===-1?form.length:streak;
   const streakLabel=streakLength>=1?finalForm+streakLength+(form.length<profile.games&&streakLength===form.length?'+':''):'';
   const scout=profile&&(ppg!==null||papg!==null||form.length)?
    '<small class="ledger26-scout" title="2026–27 verified regular-season finals: '+profile.games+' games">'+
    (ppg!==null?'<span class="ledger26-scout-stat">'+esc(ppg)+' PPG</span>':'')+
    (papg!==null?'<span class="ledger26-scout-stat ledger26-scout-defense">'+esc(papg)+' allowed</span>':'')+
    (form.length?'<span class="ledger26-form" aria-label="Last '+form.length+' verified games, oldest to newest: '+outcomes.join(', ')+'">'+form.map(v=>{
      const outcome=typeof v==='string'?v:v.result;
      const hasScore=typeof v==='object'&&v!==null&&Number.isFinite(Number(v.scored))&&Number.isFinite(Number(v.allowed));
      const opponent=typeof v==='object'&&v!==null?String(v.opponent||'Opponent'):'Opponent';
      const date=typeof v==='object'&&v!==null?String(v.date||''):'';
      const result=outcome==='W'?'Win':'Loss';
      const detail=hasScore?(date+' · '+result+' vs '+opponent+' · '+v.scored+'–'+v.allowed):result;
      const href=typeof v==='object'&&v!==null&&/^cbb-gamefile[.]html[?](?:gender=women&)?day=[0-9]{4}-[0-9]{2}-[0-9]{2}&game=[0-9]{1,12}$/.test(String(v.gameHref||''))?String(v.gameHref):'';
      return href?'<a class="ledger26-form-bulb ledger26-form-'+outcome.toLowerCase()+'" href="'+esc(href)+'" title="'+esc(detail)+'" aria-label="'+esc(detail+'; open game')+'" onclick="event.stopPropagation()"></a>':
        '<i class="ledger26-form-bulb ledger26-form-'+outcome.toLowerCase()+'" aria-hidden="true" title="'+esc(detail)+'"></i>';
    }).join('')+'</span>':'')+
    (streakLabel?'<span class="ledger26-streak" title="Recent verified form; full streak may be longer">'+esc(streakLabel)+'</span>':'')+
    '</small>':'';

   const href=/^ncaam-team\.html\?team=ncaa%3A\d+$|^ncaaw-team\.html\?team=\d+$/i.test(String(x.teamHref||''))?x.teamHref:'';
   const label=esc(x.name||'School');
   const linkedName=href?'<a class="ledger26-team-link" href="'+esc(href)+'" aria-label="Open '+label+' team page">'+label+'</a>':label;
   const scoreA=Number(x.score),scoreB=Number(other?.score);
   const scoresKnown=phase!=='upcoming'&&x.score!=null&&other?.score!=null&&Number.isFinite(scoreA)&&Number.isFinite(scoreB);
   const outcome=!scoresKnown?'even':scoreA>scoreB?'ahead':scoreA<scoreB?'behind':'even';
   // Use only verified raw artwork exposed by the logo identity system.
   // Never duplicate the ring-baked crest into the background.
   const watermarkMatch=String(x.crest||'').match(/\bdata-watermark-art=["']([^"']+)["']/i);
   const explicitArt=String(x.watermarkArt||watermarkMatch?.[1]||'').replace(/&amp;/g,'&');
   const validArt=/^(?:(?:\.\.\/|\.\/|\/)?assets\/|https:\/\/)/i.test(explicitArt)&&!/[<>"'\s]/.test(explicitArt);
   const watermark=(validArt && !/\bWilson College\b/i.test(String(x.name||'')))?'<span class="ledger26-ghost'+(/\b(?:UCF|Central Florida)\b/i.test(String(x.name||''))?' ledger26-ghost--ucf':'')+'" aria-hidden="true"><img src="'+esc(explicitArt)+'" alt="" loading="lazy" onload="window.SLTBasketballScorebug.cleanWatermark(this)"></span>':'';

   return '<div class="ledger26-team ledger26-team--'+outcome+(readableInk(x.color,phase,outcome)==='#fffaf0'?' ledger26-team--dark-fill':' ledger26-team--light-fill')+'" style="--ledger26-school:'+color(x.color)+';--ledger26-readable-ink:'+readableInk(x.color,phase,outcome)+'">'+watermark+
    '<span class="ledger26-crest">'+(x.crest||'')+'</span>'+
    '<span class="ledger26-identity"><strong class="ledger26-name">'+badge+linkedName+'</strong>'+
    '<small class="ledger26-record">'+esc(context)+
    (phase==='upcoming'&&side==='home'&&g.rivalry&&g.rivalry.name?
      '<span class="ledger26-rivalry" title="'+esc(g.rivalry.name)+'"><span aria-hidden="true"> ◆</span><span class="ledger26-rivalry-text"> '+esc(g.rivalry.name)+
      (g.rivalry.seasonH2H&&Number.isInteger(g.rivalry.seasonH2H.away)&&Number.isInteger(g.rivalry.seasonH2H.home)?
       ' · 2026–27 H2H '+g.rivalry.seasonH2H.away+'–'+g.rivalry.seasonH2H.home:'')+'</span></span>':'')+
    '</small>'+scout+timeouts+possession+momentum+'</span>'+
    '<b class="ledger26-points'+scoreClass+'"'+(upset?' title="Upset watch: lower-ranked team leads"':'')+'>'+esc(scored)+'</b></div>';
  };
  // Completed games are rendered as native table rows, outside the legacy
  // grid/flex scorebug wrappers. Each team must own a complete, unconstrained
  // table row; neither the divider nor the RETRO desk can occupy its track.
  // This uses HTML structure, not another stylesheet override.
  if(phase==='final'){
   const finalTeam=x=>{
    const t=x||{},name=esc(t.name||'School');
    const href=/^ncaam-team\.html\?team=ncaa%3A\d+$|^ncaaw-team\.html\?team=\d+$/i.test(String(t.teamHref||''))?t.teamHref:'';
    const title=href?'<a href="'+esc(href)+'">'+name+'</a>':name;
    const rating=esc(t.retro||'RETRO —'),record=esc(t.record||'Record unavailable');
    const score=t.score==null?'—':esc(String(t.score));
    const profile=t.scouting||null;
    const form=Array.isArray(profile?.lastFive)?profile.lastFive.filter(v=>v==='W'||v==='L'||(v&&['W','L'].includes(v.result))):[];
    const lamps=form.map(v=>{
      const result=typeof v==='string'?v:v.result;
      const date=typeof v==='object'?String(v.date||''):'';
      const opponent=typeof v==='object'?String(v.opponent||'Opponent'):'Opponent';
      const scored=typeof v==='object'&&Number.isFinite(Number(v.scored))?v.scored:null;
      const allowed=typeof v==='object'&&Number.isFinite(Number(v.allowed))?v.allowed:null;
      const desc=[date,result==='W'?'Win':'Loss',opponent,scored!==null&&allowed!==null?scored+'–'+allowed:''].filter(Boolean).join(' · ');
      const url=typeof v==='object'&&/^cbb-gamefile[.]html[?](?:gender=women&)?day=[0-9]{4}-[0-9]{2}-[0-9]{2}&game=[0-9]{1,12}$/.test(String(v.gameHref||''))?v.gameHref:'';
      return url?'<a class="ledger26-form-bulb ledger26-form-'+result.toLowerCase()+'" href="'+esc(url)+'" title="'+esc(desc)+'" aria-label="'+esc(desc)+'; open game" onclick="event.stopPropagation()"></a>':
       '<i class="ledger26-form-bulb ledger26-form-'+result.toLowerCase()+'" title="'+esc(desc)+'" aria-label="'+esc(desc)+'"></i>';
    }).join('');
    const ppg=profile&&Number.isFinite(profile.pointsFor)?profile.pointsFor.toFixed(1)+' PPG':'';
    const allowed=profile&&Number.isFinite(profile.pointsAgainst)?profile.pointsAgainst.toFixed(1)+' allowed':'';
    const details=[ppg,allowed].filter(Boolean).map(v=>'<span class="ledger26-scout-stat">'+esc(v)+'</span>').join(' ');
    return '<tr><td width="6" bgcolor="'+color(t.color)+'"></td>'+
      '<td width="78" valign="middle">'+(t.crest||'')+'</td>'+
      '<td valign="middle"><strong>'+title+'</strong><div><small>'+record+' · '+rating+'</small></div>'+
      ((details||lamps)?'<div><small class="ledger26-scout">'+details+
        (lamps?'<span class="ledger26-form" aria-label="Completed games oldest to newest">'+lamps+'</span>':'')+'</small></div>':'')+
      '</td><td width="64" align="right" valign="middle"><big><strong>'+score+'</strong></big></td></tr>';
   };
   const scoreA=Number(g.away?.score),scoreB=Number(g.home?.score);
   const scored=g.away?.score!=null&&g.home?.score!=null&&Number.isFinite(scoreA)&&Number.isFinite(scoreB);
   const winner=scored&&scoreA!==scoreB?(scoreA>scoreB?g.away?.name:g.home?.name):'';
   const divider='<tr bgcolor="#eee5d7"><td colspan="4" align="center"><small><strong>FINAL</strong>'+
     (winner?' · '+esc(winner)+' by '+Math.abs(scoreA-scoreB):'')+'</small></td></tr>';
   const retro=finalRetroDesk(g);
   return '<section role="group" aria-label="'+esc(g.ariaLabel||((g.away?.name||'Away')+' at '+(g.home?.name||'Home')+' final score'))+'">'+
     '<table width="100%" cellspacing="0" cellpadding="7" border="0"><tbody>'+
     finalTeam(g.away)+divider+finalTeam(g.home)+'</tbody></table>'+
     retro+'</section>';
  }
  const middle=pulseShell(g,phase,label);
  // Never reconstruct a game's pretipoff forecast from its postgame rating.
  const historical=g.historicalForecast;
  const receipt=phase!=='upcoming'&&historical&&Number.isFinite(historical.margin)?
    (()=>{
      const favorite=historical.margin>0?g.home?.name:historical.margin<0?g.away?.name:'EVEN';
      const spread=Math.round(Math.abs(historical.margin)*2)/2;
      const hasScores=Number.isFinite(historical.awayScore)&&Number.isFinite(historical.homeScore);
      const projection=hasScores?' · PROJECTED '+Math.round(historical.awayScore)+'–'+Math.round(historical.homeScore):'';
      const actual=(g.away?.score!=null&&g.home?.score!=null&&Number.isFinite(Number(g.away.score))&&Number.isFinite(Number(g.home.score)))?
        ' · ACTUAL '+Number(g.away.score)+'–'+Number(g.home.score):'';
      return '<div class="ledger26-retro-receipt" aria-label="Original pregame RETRO forecast"><strong>RETRO PREGAME</strong><span>'+
        esc(spread===0?'EVEN':String(favorite)+' −'+spread.toFixed(1))+
        esc(projection)+esc(actual)+'</span></div>';
    })():'';
  return '<div class="ledger26-scorebug'+(g.suppressMonogram?' ledger26-scorebug--plain':'')+(middle?' ledger26-scorebug--pulse':'')+(phase==='final'?' ledger26-scorebug--final':'')+(phase==='upcoming'?' ledger26-scorebug--pregame':'')+'" role="group" aria-label="'+esc(g.ariaLabel||((g.away?.name||'Away')+' at '+(g.home?.name||'Home')+' scoreboard'))+'">'+
    (g.suppressMonogram?'':'<span class="ledger26-monogram"><img src="assets/slt-engraved-black.svg" width="35" height="49" alt="Sporting Life and Times monogram"></span>')+
    (phase==='live'?'<div class="ledger26-live-headline" role="status" aria-label="Live game clock and period" style="display:flex;align-items:center;justify-content:center;gap:12px;padding:8px 10px;background:#f5e6c8;color:#35271c;border-bottom:2px solid #927657;font:700 13px Georgia,serif;letter-spacing:.025em;text-align:center">'+(function(){const raw=String(label||'LIVE');if(/\b(?:HALFTIME|HALF TIME|INTERMISSION)\b/i.test(raw))return 'HALFTIME';const clock=(raw.match(/\b\d{1,2}:\d{2}\b/)||[])[0]||'CLOCK UNAVAILABLE';const p=(raw.match(/\b(?:1st|2nd|3rd|4th|OT)\b/i)||[])[0]||'';const period=p?(/^OT$/i.test(p)?'OVERTIME':p.toUpperCase()+(g.gender==='women'?' QUARTER':' HALF')):'PERIOD UNAVAILABLE';return esc(clock)+' <span style="color:#806044">·</span> '+esc(period);})()+'</div>':'')+
    '<div class="ledger26-teams'+(phase==='final'?' ledger26-teams--final-line':'')+'">'+team(g.away)+middle+team(g.home)+'</div>'+
    (middle?'':phase==='live'?livePanel(g,label):phase==='upcoming'?pregamePanel(g):'')+(phase==='final'?finalRetroDesk(g):'')+receipt+(phase==='upcoming'&&!g.suppressPress?preview(g).split('<dialog')[0]:'')+'</div>';
 }
 // The Daily Ledger is the universal newspaper model, not a separate sport skin.
 // Keep the old alias for existing college basketball pages.
 function openPress(g){
  const shell=document.createElement('div');shell.innerHTML=preview({...g,phase:'upcoming'});
  const dialog=shell.querySelector('dialog');if(!dialog)return;
  document.body.appendChild(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  dialog.showModal();loadPress(dialog);
 }

 root.SLTSportsScorebug={render,formatRetro,openPress,cleanWatermark,version:'shared-letterpress-v19-raw-art-watermark'};
 root.SLTBasketballScorebug=root.SLTSportsScorebug;
})(typeof window!=='undefined'?window:globalThis);

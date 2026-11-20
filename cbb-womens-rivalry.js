/* Sporting Life & Times women's rivalry archive. Separate women's NCAA results, never men's totals. */
(()=>{"use strict";
 if(new URLSearchParams(location.search).get("gender")!=="women")return;
 const registry=window.SLTCBBRivalries?.registry.filter(row=>row.editions.w)||[];
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const norm=s=>String(s||"").toLowerCase().replace(/\b(university|college|the)\b/g,"").replace(/\bsaint\b/g,"st").replace(/\bstate\b/g,"st").replace(/[^a-z0-9]/g,"");
 const manual={"kentst":"kent","detroitmercy":"detroit","southern":"southernuniv","greenbay":"wigreenbay","milwaukee":"wimilwaukee","louisianamonroe":"ulm","southdakotast":"sdakotast","uconn":"connecticut","ncstate":"northcarolinast","miamioh":"miamioh","olemiss":"mississippi","westernky":"wkentucky","louisianamonroe":"ulm","et su":"easttennst","etsu":"easttennst","siue":"siuedwardsville","stjohns":"stjohnsny","uc santa barbara":"ucsantabarbara","fdu":"fairleighdickinson","northcarolinaat":"ncat","northcarolinacentral":"nccentral","bethunecookman":"bethunecookman","texasam":"texasam","texasaandm":"texasam","samhouston":"samhoustonst","stephenfaustin":"stephenfaustin","georgiasouthern":"gasouthern","georgiastate":"gastate","longbeachstate":"longbeachst","calstfullerton":"csfullerton","texasstate":"texasst"};
 const data={teams:new Map(),byName:new Map(),games:[],regularLoaded:false,tourneyLoaded:false};
 function csv(text){const rows=String(text||"").trim().split(/\r?\n/);const keys=rows.shift().split(",");return rows.filter(Boolean).map(line=>{const values=line.split(",");return Object.fromEntries(keys.map((key,i)=>[key,values[i]]))})}
 async function get(url){const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw Error("HTTP "+r.status);return r.text()}
 function teamId(label){let k=norm(label);k=manual[k]||k;return data.byName.get(k)||null}
 function matchups(){return registry.slice().sort((a,b)=>a.teams.join(" ").localeCompare(b.teams.join(" ")))}
 const root=document.querySelector("main");if(!root)return;
 root.innerHTML='<div class="eyebrow">WOMEN\'S DIVISION I · RIVALRY ALMANAC</div><h1>Women\'s Rivalry Archive</h1><p class="deck">Separate women\'s game-by-game results and rivalry stories. Results cover the 1997–98 through 2025–26 seasons. NCAA Tournament history currently runs through 2025. These are documented-period results, not all-time records.</p><div class="controls"><label for="w-series">Choose a rivalry</label><select id="w-series"></select></div><p class="notice" id="w-status" role="status">Loading women\'s results…</p><div id="w-results"></div><p class="notice">Series records count only games present in the named source files. They are not all-time records. The regular-season dataset includes conference tournament games, but does not identify those games separately.</p>';
 const womenTab=document.querySelector(".cbb-edition-switch .cbb-gender-option:last-child");const menTab=document.querySelector(".cbb-edition-switch .cbb-gender-option:first-child");
 if(womenTab){womenTab.classList.add("is-active");womenTab.setAttribute("aria-current","page")}if(menTab){menTab.classList.remove("is-active");menTab.removeAttribute("aria-current")}
 const select=$("w-series");
 for(const row of matchups()){const o=document.createElement("option");o.value=row.ids.join("|");o.textContent=row.editions.w.name+" · "+row.teams.join(" vs. ");select.appendChild(o)}
 function display(){
  const selected=registry.find(row=>row.ids.join("|")===select.value)||registry[0];if(!selected)return;
  const params=new URLSearchParams(location.search);params.set("a",selected.ids[0]);params.set("b",selected.ids[1]);params.set("gender","women");history.replaceState(null,"","?"+params.toString());
  const ids=selected.teams.map(teamId);const source=selected.editions.w.source;
  const games=data.games.filter(g=>ids[0]&&ids[1]&&((g.w===ids[0]&&g.l===ids[1])||(g.w===ids[1]&&g.l===ids[0]))).sort((a,b)=>b.season-a.season||b.day-a.day);
  const wins=games.filter(g=>g.w===ids[0]).length, losses=games.length-wins;
  const lastTen=games.slice(0,10);const lastWins=lastTen.filter(g=>g.w===ids[0]).length;
  const recent=games[0];const oldest=games[games.length-1];
  const played=game=>esc(game.season+" · "+(data.teams.get(game.w)||game.w)+" "+game.ws+"–"+game.ls+" "+(data.teams.get(game.l)||game.l)+" · "+(game.post?"NCAA Tournament":"Regular season / conference tournament"));
  const match=games.map(g=>'<article class="meeting-card"><div class="meeting-top">'+esc(g.post?"NCAA Tournament":"Season game")+' · '+esc(g.season)+'</div><div class="meeting-teams"><span class="meeting-team">'+esc(data.teams.get(g.w)||g.w)+' <strong>'+g.ws+'</strong></span><span class="meeting-team">'+esc(data.teams.get(g.l)||g.l)+' <strong>'+g.ls+'</strong></span></div></article>').join("");
  const sourceLink=source?'<p><a href="'+esc(source)+'" target="_blank" rel="noopener noreferrer">Read the rivalry source</a></p>':"";
  $("w-results").innerHTML='<section class="rivalry-hero"><div class="rivalry-team"><h2>'+esc(selected.teams[0])+'</h2><div class="hero-count">'+wins+'</div><small>Documented wins</small></div><div class="rivalry-center"><div class="eyebrow">THE RIVALRY FILES</div><div class="versus">VS</div><div class="total"><strong>'+games.length+'</strong><span>Recorded games</span></div></div><div class="rivalry-team"><h2>'+esc(selected.teams[1])+'</h2><div class="hero-count">'+losses+'</div><small>Documented wins</small></div></section>'+
  '<section class="panel editorial"><div class="section-heading"><div><div class="eyebrow">The series</div><h2>'+esc(selected.editions.w.name)+'</h2></div></div><div class="extra-stats"><div><span>Recent 10</span><strong>'+lastWins+'–'+(lastTen.length-lastWins)+'</strong></div><div><span>First in dataset</span><strong>'+(oldest?oldest.season:"—")+'</strong></div><div><span>Last in dataset</span><strong>'+(recent?recent.season:"—")+'</strong></div><div><span>NCAA tournament meetings</span><strong>'+games.filter(g=>g.post).length+'</strong></div></div>'+sourceLink+'</section>'+
  '<section class="panel editorial"><div class="section-heading"><div><div class="eyebrow">From the archive</div><h2>Notable documented games</h2></div></div>'+(recent?'<p><b>Most recent:</b> '+played(recent)+'</p><p><b>First in archive:</b> '+played(oldest)+'</p><p><b>Closest finish:</b> '+played([...games].sort((a,b)=>(a.ws-a.ls)-(b.ws-b.ls))[0])+'</p>':'<p>No game was found for this pairing in the retrieved women\'s datasets. This does not mean these schools have never played.</p>')+'</section>'+
  '<section class="panel editorial"><div class="section-heading"><div><div class="eyebrow">Results book</div><h2>Meeting-by-meeting · '+games.length+' games</h2></div></div><div class="meeting-list">'+(match||'<p>No matching results in available historical files.</p>')+'</div></section>';

  // The expanded women's almanac uses only the games belonging to the selected pair.
  if(games.length){
   const streakLeader=games[0].w;let streak=0;for(const game of games){if(game.w!==streakLeader)break;streak++}
   const bigA=[...games].filter(g=>g.w===ids[0]).sort((x,y)=>(y.ws-y.ls)-(x.ws-x.ls))[0];
   const bigB=[...games].filter(g=>g.w===ids[1]).sort((x,y)=>(y.ws-y.ls)-(x.ws-x.ls))[0];
   const byDecade=new Map();
   for(const g of games){const decade=Math.floor(g.season/10)*10;const record=byDecade.get(decade)||{a:0,b:0};if(g.w===ids[0])record.a++;else record.b++;byDecade.set(decade,record)}
   const section=document.createElement("section");section.className="panel editorial";
   const h=document.createElement("h2");h.textContent="The rivalry through the decades";section.appendChild(h);
   const desc=document.createElement("p");desc.textContent="Current documented streak: "+(streakLeader===ids[0]?selected.teams[0]:selected.teams[1])+" · "+streak+" consecutive win"+(streak===1?"":"s");section.appendChild(desc);
   const list=document.createElement("div");list.className="meeting-list";
   for(const [decade,record] of [...byDecade.entries()].sort((a,b)=>a[0]-b[0])){
    const article=document.createElement("article");article.className="meeting-card";
    article.textContent=decade+"s · "+selected.teams[0]+" "+record.a+"–"+record.b+" "+selected.teams[1];
    list.appendChild(article);
   }
   section.appendChild(list);
   const wide=document.createElement("p");wide.textContent="Largest documented wins: "+(bigA?selected.teams[0]+" by "+(bigA.ws-bigA.ls)+" ("+bigA.season+")":"none found")+"; "+(bigB?selected.teams[1]+" by "+(bigB.ws-bigB.ls)+" ("+bigB.season+")":"none found")+".";
   section.appendChild(wide);
   $("w-results").appendChild(section);
   const postseason=games.filter(g=>g.post);
   if(postseason.length){const p=document.createElement("section");p.className="panel editorial";const title=document.createElement("h2");title.textContent="NCAA Tournament chapters";p.appendChild(title);
    for(const g of postseason){const e=document.createElement("p");e.textContent=g.season+" · "+(data.teams.get(g.w)||g.w)+" "+g.ws+"–"+g.ls+" "+(data.teams.get(g.l)||g.l);p.appendChild(e)}
    $("w-results").appendChild(p)
   }
  }
  $("w-status").textContent=(data.regularLoaded?"Regular-season and conference-tournament results loaded. ":"Regular-season history unavailable; only NCAA Tournament results may be shown. ")+(data.tourneyLoaded?"NCAA Tournament results loaded. ":"NCAA Tournament history unavailable. ")+" Documented regular-season results cover 1998–2026 seasons; NCAA Tournament coverage currently ends with 2025. The 2026–27 season is not yet included.";
  document.title=selected.editions.w.name+" | Women's Rivalry Archive | Sporting Life & Times";
 }
 select.addEventListener("change",display);
 (async()=>{try{
  const archive=JSON.parse(await get("data/rivalries/womens-registered-series-1998-2026.json"));
  const byFeed=new Map((archive.series||[]).map(series=>[[...series.feedIds].sort().join("|"),series]));
  const teamText=await get("data/rivalries/womens-teams-1998-2025.csv");
  for(const row of csv(teamText)){data.teams.set(row.TeamID,row.TeamName);data.byName.set(norm(row.TeamName),row.TeamID)}
  for(const series of byFeed.values()){
   for(const game of series.games||[]){data.games.push({...game,post:Boolean(game.post)})}
  }
  data.regularLoaded=true;data.tourneyLoaded=true;
  const requested=new URLSearchParams(location.search);
  const pair=registry.find(row=>row.ids.includes(requested.get("a"))&&row.ids.includes(requested.get("b")));
  if(pair)select.value=pair.ids.join("|");
  display();
 }catch(err){$("w-status").textContent="Women's rivalry archive unavailable: "+err.message;console.error(err)}})();
})();

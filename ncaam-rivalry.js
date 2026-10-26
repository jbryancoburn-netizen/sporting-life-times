(()=>{"use strict";
const $=id=>document.getElementById(id);
const SOURCE="https://raw.githubusercontent.com/zachmayer/kaggleNCAA/master/inst/kaggle_data/";
const years=[2020,2021,2022,2023,2024,2025,2026],matches=[],names=new Map(),aliases=new Map(),known=new Set();
const logos=new Map(),teamColors=new Map();let eraLogos={},logoTimelines={};
const norm=s=>String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"");
const dateAdd=(base,days)=>{const d=new Date(base+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10)};
function parseCSV(raw){const lines=raw.replace(/^\uFEFF/,"").trim().split(/\r?\n/);const cols=lines.shift().split(",");return lines.filter(Boolean).map(line=>{const v=line.split(",");const x={};cols.forEach((c,i)=>x[c]=v[i]);return x})}
function register(label,id){if(!label||!id)return;const key=norm(label);if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key).add(String(id))}
function resolve(label){const ids=aliases.get(norm(label));return ids&&ids.size===1?[...ids][0]:null}
function name(id){return names.get(String(id))||String(id)}
async function download(url){const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw Error("HTTP "+r.status+" for "+url);return r.text()}
 const logoFor=(id,year)=>{const entries=eraLogos[id]||[];const found=entries.find(x=>year>=x.start&&year<=x.end&&x.url);return {historical:found?found.url:null,current:logos.get(id)||null,verified:!!found};};
 const applyTheme=(elem,id)=>{const colors=teamColors.get(id)||["#293F5F","#D6AF69"];elem.style.setProperty("--club",colors[0]);elem.style.setProperty("--club-secondary",colors[1])};
async function start(){


 $("status").textContent="Loading 1985–2019 historical results and modern game records…";
 const sources=["teams.csv","TeamSpellings.csv","seasons.csv","RegularSeasonCompactResults.csv","NCAATourneyCompactResults.csv","SecondaryTourneyCompactResults.csv"];
 const responses=await Promise.allSettled(sources.map(n=>download(SOURCE+n)));
 const [teamText,spellingText,seasonText,resultsText,ncaaText,secondaryText]=responses.map(x=>x.status==="fulfilled"?x.value:"");
 const failedHistorical=sources.filter((_,i)=>responses[i].status!=="fulfilled");
 if(!teamText||!seasonText||!resultsText)throw Error("Core historical data unavailable: "+failedHistorical.join(", "));
 for(const row of parseCSV(teamText)){names.set(row.TeamID,row.TeamName);register(row.TeamName,row.TeamID)}
 if(spellingText)for(const row of parseCSV(spellingText))register(row.TeamNameSpelling,row.TeamID);
 for(const [alias,canonical] of [["UConn","Connecticut"],["NC State","North Carolina St"],["Michigan State","Michigan St"],["Ohio State","Ohio St"],["Kansas State","Kansas St"],["Penn State","Penn St"],["Purdue Fort Wayne","IPFW"]]){const id=resolve(canonical);if(id)register(alias,id)}
 const palette={"Indiana":["#990000","#EEEDEB"],"Purdue":["#CEB888","#000000"],"Duke":["#003087","#FFFFFF"],"North Carolina":["#7BAFD4","#FFFFFF"],"Kansas":["#0051BA","#E8000D"],"Kentucky":["#0033A0","#FFFFFF"],"Louisville":["#AD0000","#000000"],"UConn":["#000E2F","#FFFFFF"],"UCLA":["#2D68C4","#F2A900"],"Michigan":["#00274C","#FFCB05"],"Michigan St":["#18453B","#FFFFFF"],"Michigan State":["#18453B","#FFFFFF"],"Syracuse":["#F76900","#FFFFFF"],"Gonzaga":["#002967","#C8102E"],"Kansas St":["#512888","#FFFFFF"],"Pittsburgh":["#003594","#FFB81C"],"Ohio St":["#BB0000","#666666"],"North Carolina St":["#CC0000","#FFFFFF"],"Florida":["#0021A5","#FA4616"],"Arizona":["#AB0520","#0C234B"],"Villanova":["#00205B","#13B5EA"],"Purdue Fort Wayne":["#003F87","#FFFFFF"],"Wisconsin":["#C5050C","#FFFFFF"],"Illinois":["#13294B","#E84A27"],"Tennessee":["#FF8200","#FFFFFF"],"Texas":["#BF5700","#FFFFFF"],"Auburn":["#0C2340","#E87722"],"Alabama":["#9E1B32","#FFFFFF"]};
 for(const [school,colors] of Object.entries(palette)){const id=resolve(school);if(id)teamColors.set(id,colors)}
 try{
  const r=await fetch("data/ncaam-2026-27-espn-team-crosswalk.json",{cache:"force-cache"});
  if(r.ok){const cross=await r.json();for(const t of cross.teams||[]){
   const candidates=[t.name,t.espn_name,String(t.name||"").replace(/\s+(Wildcats|Blue Devils|Tar Heels|Hoosiers|Boilermakers|Bulldogs|Spartans|Jayhawks|Huskies|Bruins|Cardinals|Orange|Cougars|Tigers|Gators|Volunteers|Aggies)$/i,"")];
   const id=candidates.map(resolve).find(Boolean) || (t.name==="UConn"?resolve("Connecticut"):null) || (t.name==="NC State"?resolve("North Carolina St"):null);
   if(id&&Number(t.espn_id)>0&&t.match_method!=="exact-team-name-fallback")logos.set(id,"https://a.espncdn.com/i/teamlogos/ncaa/500/"+Number(t.espn_id)+".png");
  }}
 }catch(e){console.warn("Logo crosswalk unavailable",e)}
 try{const resp=await fetch("data/ncaam-rivalry-era-logos.json?v=2",{cache:"no-cache"});if(resp.ok)eraLogos=await resp.json()}catch(e){}
 try{const resp=await fetch("data/ncaam-rivalry-logo-timelines.json",{cache:"force-cache"});if(resp.ok)logoTimelines=(await resp.json()).teams||{}}catch(e){}

 const zero=new Map(parseCSV(seasonText).map(row=>{const [m,d,y]=row.DayZero.split("/");return [row.Season,y+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0")]}));
 let historical=0;for(const row of parseCSV(resultsText)){
  const base=zero.get(row.Season);if(!base||!names.has(row.WTeamID)||!names.has(row.LTeamID))continue;
  const date=dateAdd(base,row.DayNum);matches.push({date,season:Number(row.Season),a:row.WTeamID,b:row.LTeamID,as:Number(row.WScore),bs:Number(row.LScore),historical:true,tournament:"Regular season",source:"Historical NCAA"});historical++;
 }
 let postCount=0;
 for(const [raw,family] of [[ncaaText,"NCAA Tournament"],[secondaryText,"Secondary"]]){if(!raw)continue;
  for(const row of parseCSV(raw)){
   const base=zero.get(row.Season);if(!base||!names.has(row.WTeamID)||!names.has(row.LTeamID))continue;
   const date=dateAdd(base,row.DayNum);
   const tournament=family==="NCAA Tournament"?"NCAA Tournament":(row.SecondaryTourney||"Other postseason").trim().toUpperCase()==="NIT"?"NIT":(row.SecondaryTourney||"Other postseason").trim();
   matches.push({date,season:Number(row.Season),a:row.WTeamID,b:row.LTeamID,as:Number(row.WScore),bs:Number(row.LScore),historical:true,tournament,source:family});
   postCount++;
  }
 }
 let verified2021=new Map();try{const response=await fetch("data/ncaam-postseason-2021-verified.json",{cache:"force-cache"});if(response.ok){const dataset=await response.json();for(const g of dataset.games||[]){const key=[g.season,g.winner,g.loser,g.ws,g.ls].join("|");verified2021.set(key,g.tournament)}}}catch(e){console.warn("2021 tournament classification unavailable",e)}
 let classified=0;
 let recent=0,unmatched=new Map(),failed=[];
 for(const year of years){
  try{const rows=parseCSV(await download("historical-normalized/sportsdataverse/ncaa-"+year+"-verified-results.csv"));
   for(const g of rows){const h=resolve(g.homeTeam),a=resolve(g.awayTeam);
    if(!h||!a||h===a){for(const n of [g.homeTeam,g.awayTeam])if(!resolve(n))unmatched.set(n,(unmatched.get(n)||0)+1);continue}
    const hs=Number(g.homePoints),as=Number(g.awayPoints);
    if(!Number.isFinite(hs)||!Number.isFinite(as)||hs===as)continue;
    const winner=hs>as?h:a,loser=hs>as?a:h,ws=Math.max(hs,as),ls=Math.min(hs,as);
    const key=[year,winner,loser,ws,ls].join("|");
    const confirmed=verified2021.get(key);
    const tournament=confirmed||(year===2020?"Competition not verified":"Competition not verified");
    if(confirmed)classified++;
    matches.push({date:g.date,season:year,a:h,b:a,as:hs,bs:as,historical:false,tournament,source:confirmed?"2021 verified postseason results":"NCAA schedules"});recent++}
  }catch(e){failed.push(year)}
 }
 for(const game of matches){known.add(game.a);known.add(game.b)}
 const options=[...known].sort((a,b)=>name(a).localeCompare(name(b)));
 for(const element of [$("home"),$("away")]){element.replaceChildren();for(const id of options){const o=document.createElement("option");o.value=id;o.textContent=name(id);element.appendChild(o)}}
 $("home").value=resolve("Indiana")||options[0];$("away").value=resolve("Purdue")||options[1];
 $("status").textContent="Archive loaded. "+historical.toLocaleString()+" regular-season historical games plus "+postCount.toLocaleString()+" documented postseason games (1985–2019), and "+recent.toLocaleString()+" identity-matched recent games (2020–2026), including "+classified+" confirmed 2021 postseason games."+(unmatched.size?" Some recent school-name aliases are unmatched and excluded.":"")+(failed.length?" Unavailable recent files: "+failed.join(", "):"")+(failedHistorical.length?" Unavailable historical files: "+failedHistorical.join(", "):"")+" Current team logos mapped: "+logos.size+"; vintage logo periods: "+Object.values(eraLogos).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0)+".";
 show();
}
function show(){
 const a=$("home").value,b=$("away").value;if(!a||!b)return;
 $("output").hidden=false;const seen=new Set(),arr=[];
 for(const g of matches){if(!((g.a===a&&g.b===b)||(g.a===b&&g.b===a)))continue;
 const key=g.date+"|"+[g.a,g.b].sort().join("|")+"|"+[g.as,g.bs].sort((x,y)=>x-y).join("|");
 if(seen.has(key))continue;seen.add(key);arr.push(g)}
 arr.sort((x,y)=>y.date.localeCompare(x.date));
 const won=g=>((g.a===a?g.as:g.bs)>(g.a===a?g.bs:g.as));
 const wins=arr.filter(won).length,losses=arr.length-wins,last10=arr.slice(0,10),lastWins=last10.filter(won).length;
 const mklogo=(team,element,year)=>{element.replaceChildren();const choice=logoFor(team,year||2026),fallback=()=>{element.replaceChildren();element.textContent=name(team).slice(0,2).toUpperCase();element.title="No verified logo image available"};const display=(url,isVintage)=>{if(!url){fallback();return}const img=document.createElement("img");img.src=url;img.alt=name(team)+(isVintage?" historical ":" current ")+"logo";img.loading="lazy";img.onerror=()=>{if(isVintage&&choice.current&&choice.current!==url)display(choice.current,false);else fallback()};element.replaceChildren(img);element.title=isVintage?name(team)+" · historical "+(eraLogos[team]||[]).find(x=>year>=x.start&&year<=x.end)?.mark_type+" for "+year:name(team)+" · current logo fallback (historical artwork unavailable for "+year+")"};display(choice.historical||choice.current,!!choice.historical)};
 $("matchup").textContent=name(a)+" vs. "+name(b);$("team-a-name").textContent=name(a);$("team-b-name").textContent=name(b);mklogo(a,$("team-a-logo"));mklogo(b,$("team-b-logo"));
 applyTheme($("hero-a"),a);applyTheme($("hero-b"),b);
 $("meetings").textContent=arr.length;$("record").textContent=wins+"–"+losses;$("recent").textContent=arr.length?arr[0].date:"None";
 $("series-a").textContent=wins;$("series-b").textContent=losses;$("series-a-name").textContent=name(a);$("series-b-name").textContent=name(b);
 $("win-bar-a").style.width=(arr.length?100*wins/arr.length:50)+"%";$("win-bar-b").style.width=(arr.length?100*losses/arr.length:50)+"%";$("win-bar-a").style.background=(teamColors.get(a)||["#ae634c"])[0];$("win-bar-b").style.background=(teamColors.get(b)||["#356a8b"])[0];
 $("last-ten").textContent=lastWins+"–"+(last10.length-lastWins);
 let streak=0,leader="";for(const g of arr){const thisWinner=won(g)?a:b;if(leader&&leader!==thisWinner)break;leader=thisWinner;streak++}
 $("streak").textContent=streak?name(leader)+" · "+streak:"—";
 const sortedMargins=arr.map(g=>({game:g,margin:Math.abs(g.as-g.bs)})).sort((x,y)=>y.margin-x.margin);
 $("blowout").textContent=sortedMargins.length?sortedMargins[0].margin+" points":"—";
 $("closest").textContent=arr.length?Math.min(...arr.map(g=>Math.abs(g.as-g.bs)))+" points":"—";
 const counts=new Map();for(const g of arr){const decade=Math.floor(Number(g.date.slice(0,4))/10)*10;const d=counts.get(decade)||{w:0,l:0};d[won(g)?"w":"l"]++;counts.set(decade,d)}
 const decades=$("decades");decades.replaceChildren();for(const [decade,record] of [...counts].sort((x,y)=>x[0]-y[0])){const wrapper=document.createElement("div");wrapper.className="decade-row";const label=document.createElement("span");label.textContent=decade+"s";const bar=document.createElement("div");bar.className="decade-bar";const left=document.createElement("span");left.className="decade-left";left.style.width=(100*record.w/(record.w+record.l))+"%";const right=document.createElement("span");right.className="decade-right";right.style.width=(100*record.l/(record.w+record.l))+"%";bar.append(left,right);const value=document.createElement("b");value.textContent=record.w+"–"+record.l;wrapper.append(label,bar,value);decades.append(wrapper)}
 const filter=$("filter").value;const scope=$("tournament-filter").value;const eligible=arr.filter(g=>scope==="all"|| (scope==="other"?!["Regular season","NCAA Tournament","NIT","Competition not verified"].includes(g.tournament):g.tournament===scope));const list=filter==="ten"?eligible.slice(0,10):filter==="five"?eligible.slice(0,5):eligible;
 const cards=$("games");cards.replaceChildren();
 if(!list.length){const empty=document.createElement("p");empty.className="notice";empty.textContent="No recorded meetings in this archive.";cards.append(empty)}
 for(const g of list){const card=document.createElement("article");card.className="meeting-card";card.style.setProperty("--winner-color",(teamColors.get(g.as>g.bs?g.a:g.b)||["#7A5544"])[0]);const top=document.createElement("div");top.className="meeting-top";const date=document.createElement("span");date.textContent=g.date+" · "+(Number(g.season)-1)+"–"+String(g.season).slice(-2)+" season";const label=document.createElement("span");label.textContent=g.tournament;top.append(date,label);const row=document.createElement("div");row.className="meeting-teams";for(const [team,score] of [[g.a,g.as],[g.b,g.bs]]){const block=document.createElement("div");block.className="meeting-team"+(score> (team===g.a?g.bs:g.as)?" winning":"");const logo=document.createElement("span");logo.className="small-logo";mklogo(team,logo,Number(g.date.slice(0,4))||g.season);const t=document.createElement("span");t.textContent=name(team);const n=document.createElement("strong");n.textContent=score;block.append(logo,t,n);row.append(block)}card.append(top,row);const references=document.createElement("div");references.className="era-references";for(const team of [g.a,g.b]){const gameYear=Number(g.date.slice(0,4))||g.season;const artwork=(eraLogos[team]||[]).find(x=>gameYear>=x.start&&gameYear<=x.end&&x.source_url);const entry=artwork|| (logoTimelines[team]||[]).find(x=>gameYear>=x.start&&gameYear<=x.end);if(entry){const a=document.createElement("a");a.href=entry.source_url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=artwork?name(team)+" · Logo: "+artwork.source:name(team)+" · "+entry.label+" (historical logo reference)";references.append(a)}}if(references.childElementCount)card.append(references);cards.append(card)}
}

$("show").addEventListener("click",show);$("filter").addEventListener("change",show);$("tournament-filter").addEventListener("change",show);start().catch(e=>{$("status").textContent="Historical archive retrieval failed: "+e.message});
})();
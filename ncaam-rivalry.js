(()=>{"use strict";
const $=id=>document.getElementById(id);
const SOURCE="https://raw.githubusercontent.com/zachmayer/kaggleNCAA/master/inst/kaggle_data/";
const years=[2020,2021,2022,2023,2024,2025,2026],matches=[],names=new Map(),aliases=new Map(),known=new Set();
const logos=new Map(),teamColors=new Map();
const norm=s=>String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"");
const dateAdd=(base,days)=>{const d=new Date(base+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10)};
function parseCSV(raw){const lines=raw.replace(/^\uFEFF/,"").trim().split(/\r?\n/);const cols=lines.shift().split(",");return lines.filter(Boolean).map(line=>{const v=line.split(",");const x={};cols.forEach((c,i)=>x[c]=v[i]);return x})}
function register(label,id){if(!label||!id)return;const key=norm(label);if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key).add(String(id))}
function resolve(label){const ids=aliases.get(norm(label));return ids&&ids.size===1?[...ids][0]:null}
function name(id){return names.get(String(id))||String(id)}
async function download(url){const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw Error("HTTP "+r.status+" for "+url);return r.text()}
async function start(){
 try{const [cross,pre]=await Promise.all(["data/ncaam-2026-27-espn-team-crosswalk.json","data/ncaam-2026-27-preseason-player-quality-live.json"].map(async u=>{const r=await fetch(u);return r.ok?r.json():null}));const byTeam=new Map((pre?.rankings||[]).map(t=>[norm(t.team),t]));for(const t of (cross?.teams||[])){const rating=byTeam.get(norm(t.team||t.name||""));const id=resolve(t.team||t.name||rating?.team);if(id&&Number(t.espn_id)>0){logos.set(id,"https://a.espncdn.com/i/teamlogos/ncaa/500/"+t.espn_id+".png");if(rating?.color)teamColors.set(id,rating.color)}}}catch(e){}

 $("status").textContent="Loading 1985–2019 historical results and modern game records…";
 const [teamText,spellingText,seasonText,resultsText]=await Promise.all(["teams.csv","TeamSpellings.csv","seasons.csv","RegularSeasonCompactResults.csv"].map(n=>download(SOURCE+n)));
 for(const row of parseCSV(teamText)){names.set(row.TeamID,row.TeamName);register(row.TeamName,row.TeamID)}
 for(const row of parseCSV(spellingText))register(row.TeamNameSpelling,row.TeamID);
 const zero=new Map(parseCSV(seasonText).map(row=>{const [m,d,y]=row.DayZero.split("/");return [row.Season,y+"-"+m.padStart(2,"0")+"-"+d.padStart(2,"0")]}));
 let historical=0;for(const row of parseCSV(resultsText)){
  const base=zero.get(row.Season);if(!base||!names.has(row.WTeamID)||!names.has(row.LTeamID))continue;
  const date=dateAdd(base,row.DayNum);matches.push({date,season:Number(row.Season),a:row.WTeamID,b:row.LTeamID,as:Number(row.WScore),bs:Number(row.LScore),historical:true});historical++;
 }
 let recent=0,unmatched=new Map(),failed=[];
 for(const year of years){
  try{const rows=parseCSV(await download("historical-normalized/sportsdataverse/ncaa-"+year+"-verified-results.csv"));
   for(const g of rows){const h=resolve(g.homeTeam),a=resolve(g.awayTeam);
    if(!h||!a||h===a){for(const n of [g.homeTeam,g.awayTeam])if(!resolve(n))unmatched.set(n,(unmatched.get(n)||0)+1);continue}
    const hs=Number(g.homePoints),as=Number(g.awayPoints);
    if(!Number.isFinite(hs)||!Number.isFinite(as)||hs===as)continue;
    matches.push({date:g.date,season:year,a:h,b:a,as:hs,bs:as,historical:false});recent++}
  }catch(e){failed.push(year)}
 }
 for(const game of matches){known.add(game.a);known.add(game.b)}
 const options=[...known].sort((a,b)=>name(a).localeCompare(name(b)));
 for(const element of [$("home"),$("away")]){element.replaceChildren();for(const id of options){const o=document.createElement("option");o.value=id;o.textContent=name(id);element.appendChild(o)}}
 $("home").value=resolve("Indiana")||options[0];$("away").value=resolve("Purdue")||options[1];
 $("status").textContent=historical.toLocaleString()+" historical games (1985–2019) and "+recent.toLocaleString()+" identity-matched recent games (2020–2026)."+(unmatched.size?" Some recent school-name aliases are unmatched and excluded.":"")+(failed.length?" Unavailable recent files: "+failed.join(", "):"");
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
 const mklogo=(team,element)=>{element.replaceChildren();const url=logos.get(team);if(url){const img=document.createElement("img");img.src=url;img.alt=name(team)+" logo";img.loading="lazy";img.onerror=()=>{element.textContent=name(team).slice(0,2).toUpperCase()};element.append(img)}else element.textContent=name(team).slice(0,2).toUpperCase()};
 $("matchup").textContent=name(a)+" vs. "+name(b);$("team-a-name").textContent=name(a);$("team-b-name").textContent=name(b);mklogo(a,$("team-a-logo"));mklogo(b,$("team-b-logo"));
 $("hero-a").style.setProperty("--club",teamColors.get(a)||"#8a292f");$("hero-b").style.setProperty("--club",teamColors.get(b)||"#234e75");
 $("meetings").textContent=arr.length;$("record").textContent=wins+"–"+losses;$("recent").textContent=arr.length?arr[0].date:"None";
 $("series-a").textContent=wins;$("series-b").textContent=losses;$("series-a-name").textContent=name(a);$("series-b-name").textContent=name(b);
 $("win-bar-a").style.width=(arr.length?100*wins/arr.length:50)+"%";$("win-bar-b").style.width=(arr.length?100*losses/arr.length:50)+"%";
 $("last-ten").textContent=lastWins+"–"+(last10.length-lastWins);
 let streak=0,leader="";for(const g of arr){const thisWinner=won(g)?a:b;if(leader&&leader!==thisWinner)break;leader=thisWinner;streak++}
 $("streak").textContent=streak?name(leader)+" · "+streak:"—";
 const sortedMargins=arr.map(g=>({game:g,margin:Math.abs(g.as-g.bs)})).sort((x,y)=>y.margin-x.margin);
 $("blowout").textContent=sortedMargins.length?sortedMargins[0].margin+" points":"—";
 $("closest").textContent=arr.length?Math.min(...arr.map(g=>Math.abs(g.as-g.bs)))+" points":"—";
 const counts=new Map();for(const g of arr){const decade=Math.floor(Number(g.season)/10)*10;const d=counts.get(decade)||{w:0,l:0};d[won(g)?"w":"l"]++;counts.set(decade,d)}
 const decades=$("decades");decades.replaceChildren();for(const [decade,record] of [...counts].sort((x,y)=>x[0]-y[0])){const wrapper=document.createElement("div");wrapper.className="decade-row";const label=document.createElement("span");label.textContent=decade+"s";const bar=document.createElement("div");bar.className="decade-bar";const left=document.createElement("span");left.className="decade-left";left.style.width=(100*record.w/(record.w+record.l))+"%";const right=document.createElement("span");right.className="decade-right";right.style.width=(100*record.l/(record.w+record.l))+"%";bar.append(left,right);const value=document.createElement("b");value.textContent=record.w+"–"+record.l;wrapper.append(label,bar,value);decades.append(wrapper)}
 const filter=$("filter").value;const list=filter==="ten"?arr.slice(0,10):filter==="five"?arr.slice(0,5):arr;
 const cards=$("games");cards.replaceChildren();
 if(!list.length){const empty=document.createElement("p");empty.className="notice";empty.textContent="No recorded meetings in this archive.";cards.append(empty)}
 for(const g of list){const card=document.createElement("article");card.className="meeting-card";const top=document.createElement("div");top.className="meeting-top";const date=document.createElement("span");date.textContent=g.date+" · "+g.season;const label=document.createElement("span");label.textContent=g.historical?"Historical archive":"NCAA score archive";top.append(date,label);const row=document.createElement("div");row.className="meeting-teams";for(const [team,score] of [[g.a,g.as],[g.b,g.bs]]){const block=document.createElement("div");block.className="meeting-team"+(score> (team===g.a?g.bs:g.as)?" winning":"");const logo=document.createElement("span");logo.className="small-logo";mklogo(team,logo);const t=document.createElement("span");t.textContent=name(team);const n=document.createElement("strong");n.textContent=score;block.append(logo,t,n);row.append(block)}card.append(top,row);cards.append(card)}
}

$("show").addEventListener("click",show);$("filter").addEventListener("change",show);start().catch(e=>{$("status").textContent="Historical archive retrieval failed: "+e.message});
})();
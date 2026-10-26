(()=>{"use strict";
const $=id=>document.getElementById(id);
const SOURCE="https://raw.githubusercontent.com/zachmayer/kaggleNCAA/master/inst/kaggle_data/";
const years=[2020,2021,2022,2023,2024,2025,2026],matches=[],names=new Map(),aliases=new Map(),known=new Set();
const norm=s=>String(s||"").toLowerCase().replace(/&/g,"and").replace(/[^a-z0-9]/g,"");
const dateAdd=(base,days)=>{const d=new Date(base+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10)};
function parseCSV(raw){const lines=raw.replace(/^\uFEFF/,"").trim().split(/\r?\n/);const cols=lines.shift().split(",");return lines.filter(Boolean).map(line=>{const v=line.split(",");const x={};cols.forEach((c,i)=>x[c]=v[i]);return x})}
function register(label,id){if(!label||!id)return;const key=norm(label);if(!aliases.has(key))aliases.set(key,new Set());aliases.get(key).add(String(id))}
function resolve(label){const ids=aliases.get(norm(label));return ids&&ids.size===1?[...ids][0]:null}
function name(id){return names.get(String(id))||String(id)}
async function download(url){const r=await fetch(url,{cache:"force-cache"});if(!r.ok)throw Error("HTTP "+r.status+" for "+url);return r.text()}
async function start(){
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
function show(){const a=$("home").value,b=$("away").value;if(!a||!b)return;
 $("output").hidden=false;$("matchup").textContent=name(a)+" vs. "+name(b);
 const seen=new Set(),arr=[];
 for(const g of matches){if(!((g.a===a&&g.b===b)||(g.a===b&&g.b===a)))continue;
  const key=g.date+"|"+[g.a,g.b].sort().join("|")+"|"+[g.as,g.bs].sort((x,y)=>x-y).join("|");
  if(seen.has(key))continue;seen.add(key);arr.push(g)}
 arr.sort((x,y)=>y.date.localeCompare(x.date));
 const wins=arr.filter(g=>(g.a===a?g.as:g.bs)>(g.a===a?g.bs:g.as)).length;
 $("meetings").textContent=arr.length;$("record").textContent=wins+"–"+(arr.length-wins);$("recent").textContent=arr.length?arr[0].date:"None";
 const body=$("games");body.replaceChildren();
 if(!arr.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=3;td.textContent="No documented meetings in the available 1985–2026 results.";tr.append(td);body.append(tr)}
 for(const g of arr){const tr=document.createElement("tr");for(const v of [g.date,name(g.a)+" "+g.as+" – "+name(g.b)+" "+g.bs,g.as>g.bs?name(g.a):name(g.b)]){const td=document.createElement("td");td.textContent=v;tr.append(td)}body.append(tr)}
}
$("show").addEventListener("click",show);start().catch(e=>{$("status").textContent="Historical archive retrieval failed: "+e.message});
})();
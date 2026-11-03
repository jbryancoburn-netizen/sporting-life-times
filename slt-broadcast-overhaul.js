/* SLT Broadcast Edition v3. Visual treatment only; never changes scores, live feeds, Elo or school logos. */
(function(){
"use strict";
const filename=(location.pathname.split("/").pop()||"index.html").toLowerCase();
const sport=/politics/.test(filename)?"politics":
 /^(?:nba|nba-|wnba)/.test(filename)?"basketball":
 /^(?:nfl|nfl-|cfb|cfb-|cfl|fcs|d2-football|d3-football|college-football)/.test(filename)?"football":
 /^(?:mlb|college-baseball|npb|kbo)/.test(filename)?"baseball":
 /^(?:nhl|echl|ahl|college-hockey)/.test(filename)?"hockey":
 /(?:epl|soccer|mls|seriea|serie-a|premier|bundesliga|liga-mx|ligamx|laliga|la-liga|ligue|champions|championship|uefa|^ucl|^uel|^uecl|eredivisie|brasileirao|brazil-serie-a|argentina-primera|conference-league|europa|primeira|scottish)/.test(filename)?"soccer":
 /(?:basket|ncaam|ncaaw|ncaad|cbb|nbl|euroleague|eurocup|acb|bbl|bleague|b-league|lnb|lba|kbl|nbb|bsl|cba|^wnba|d2-men|d3-men|d2-women|d3-women)/.test(filename)?"basketball":"multi";
const edition=filename.startsWith("nba")?["NBA BASKETBALL","PROFESSIONAL COURT · 2026–27"]:
filename.startsWith("nfl")?["NFL FOOTBALL","GRIDIRON EDITION · 2026"]:
filename.startsWith("epl")?["PREMIER LEAGUE","ENGLISH FOOTBALL · 2026–27"]:
filename.startsWith("mlb")?["MAJOR LEAGUE BASEBALL","THE DIAMOND DESK"]:
filename.startsWith("nhl")?["NATIONAL HOCKEY LEAGUE","THE ICE DESK"]:
filename.startsWith("cfb")||filename.startsWith("college-football")?["COLLEGE FOOTBALL","THE GRIDIRON DESK · 2026"]:
filename.includes("college-soccer")?["COLLEGE SOCCER","THE PITCH · 2026"]:
filename.startsWith("nbl")?["AUSTRALIAN NBL","PROFESSIONAL COURT · 2026–27"]:
filename.startsWith("euroleague")?["EUROLEAGUE","EUROPEAN BASKETBALL · 2026–27"]:
filename.startsWith("wnba")?["WNBA BASKETBALL","PROFESSIONAL COURT"]:
filename.startsWith("ncaam")||filename.startsWith("ncaaw")||filename.startsWith("cbb-")||filename.includes("college-basketball")?["NCAA BASKETBALL","THE COLLEGE COURT · 2026–27"]:
filename.startsWith("d2-")||filename.startsWith("d3-")?["NCAA BASKETBALL","THE DIVISION DESKS · 2026–27"]:
filename.startsWith("mls")?["MAJOR LEAGUE SOCCER","THE PITCH"]:
filename.includes("soccer")?["FOOTBALL & SOCCER","THE PITCH"]:
filename==="index.html"||filename==="sports.html"?["SPORTS DESKS","SPORTING LIFE AND TIMES"]:
[{"basketball":"BASKETBALL","football":"FOOTBALL","baseball":"BASEBALL","soccer":"WORLD FOOTBALL","hockey":"HOCKEY","multi":"ALL SPORTS","politics":"POLITICS"}[sport]||"SPORTS", "INDEPENDENT NEWS · SCORES · RATINGS"];
function apply(){
if(sport==="politics")return; // Keep political district newsroom independent.
document.body.classList.add("slt-overhaul");
document.body.dataset.sltChannel=sport;
const header=document.querySelector("header");
if(!header||header.querySelector(".slt-broadcast-ribbon"))return;
const selector=".slt-retro-masthead,.sl-masthead,.masthead,.nfl-mast,.paper-masthead,.mast";
const mast=header.matches(selector)?header:header.querySelector(selector);
if(!mast)return;
const classic=mast.matches(".sl-masthead")?mast.querySelector("a[href]"):null;
if(classic&&!classic.classList.contains("slt-brand-link")){
 classic.textContent="SPORTING LIFE AND TIMES";classic.setAttribute("aria-label","Sporting Life and Times home");
 classic.classList.add("slt-slate-masthead-title");
}
const ribbon=document.createElement("div");ribbon.className="slt-broadcast-ribbon";ribbon.setAttribute("aria-label",edition[0]+" edition");
const brand=document.createElement("span");brand.className="slt-broadcast-monogram";brand.textContent="SLT";
const left=document.createElement("strong");left.className="slt-broadcast-channel";left.textContent=edition[0];
const right=document.createElement("span");right.className="slt-broadcast-edition";right.textContent=edition[1];
const bars=document.createElement("span");bars.className="slt-broadcast-bars";bars.setAttribute("aria-hidden","true");
ribbon.append(brand,left,right,bars);
mast.insertAdjacentElement("afterend",ribbon);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",apply,{once:true});else apply();
})();

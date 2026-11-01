(function(){
"use strict";
var data=null,activeView="senate",activeMap="senate",selectedState=null;
var $=function(id){return document.getElementById(id);};
var partyColors={D:"#3165a8",R:"#af4843",I:"#83928e"};
function countdown(){
 var target=Date.UTC(2026,10,3,12,0,0),now=Date.now(),diff=target-now;
 if(diff<=0){$("countdown").textContent="Election Day · archival forecast";return;}
 var days=Math.floor(diff/86400000),hours=Math.floor((diff%86400000)/3600000);
 $("countdown").textContent=days+" day"+(days===1?"":"s")+" · "+hours+" hr until 7 a.m. ET";
}
function senateRace(state){return data.senate.find(function(r){return r.state===state;});}
function stateName(code){var item=data.states.find(function(s){return s[0]===code;});return item?item[1]:code;}
function renderMap(){
 var target=$("state-map");target.replaceChildren();
 var senateSet=new Set(data.senateBallotStates),govSet=new Set(data.governorBallotStates);
 data.states.forEach(function(state){
  var code=state[0],button=document.createElement("button"),hasRace=(activeMap==="senate"?senateSet:govSet).has(code),r=activeMap==="senate"?senateRace(code):null;
  button.type="button";button.textContent=code;button.className="state-tile "+(hasRace?"election":"no-election")+(r?" party-"+r.fav.toLowerCase():"")+(selectedState===code?" selected":"");
  button.style.setProperty("--col",state[2]);button.style.setProperty("--row",state[3]);
  button.setAttribute("aria-label",state[1]+": "+(hasRace?(r?r.rating+", "+r.name+" favored":activeMap==="senate"?"Senate election, forecast not loaded":"Governor election scheduled"):"No "+(activeMap==="senate"?"Senate":"governor")+" election"));
  button.setAttribute("aria-pressed",selectedState===code?"true":"false");
  button.addEventListener("click",function(){selectedState=code;renderMap();renderStateDetail();});
  target.appendChild(button);
 });
 $("map-caption").textContent=activeMap==="senate"?"Schematic tile map · colored states are a verified subset of DDHQ Senate forecasts; gray is not a prediction.":"Schematic tile map · highlighted states have a governor election in 2026. No state-level governor forecast has been loaded.";
 renderStateDetail();
}
function renderStateDetail(){
 var el=$("state-detail");
 if(!selectedState){el.innerHTML='<span class="eyebrow">EXPLORE THE MAP</span><h3>Select a state</h3><p>Choose a state tile to inspect its ballot status and available forecast. Not every race has been imported.</p>';return;}
 var name=stateName(selectedState),senateOn=data.senateBallotStates.includes(selectedState),govOn=data.governorBallotStates.includes(selectedState);
 if(activeMap==="governors"){
  el.innerHTML='<span class="eyebrow">GOVERNOR ELECTION ATLAS</span><h3>'+name+'</h3><p>'+(govOn?"A gubernatorial election is scheduled for November 3, 2026.":"No gubernatorial election is scheduled for November 3, 2026.")+'</p><p>We have not imported an individually verified governor forecast for this state. No party is assigned.</p><a href="https://ballotpedia.org/United_States_gubernatorial_elections,_2026" target="_blank" rel="noopener">See gubernatorial ballot guide ↗</a>';return;
 }
 var r=senateRace(selectedState);
 if(!senateOn){el.innerHTML='<span class="eyebrow">SENATE ELECTION ATLAS</span><h3>'+name+'</h3><p>No U.S. Senate election is scheduled here for November 3, 2026.</p><p>'+ (govOn?"A governor election is scheduled; switch layers to explore it.":"The state has no governor election on the ballot either.")+'</p>';return;}
 if(!r){el.innerHTML='<span class="eyebrow">SENATE ELECTION ATLAS</span><h3>'+name+'</h3><p>A U.S. Senate election is scheduled, but this edition does not yet include a verified individual DDHQ probability for this state.</p><p>Unrated here does not mean a toss-up.</p>';return;}
 el.innerHTML='<span class="eyebrow">DDHQ SENATE FORECAST · OCT 31</span><h3>'+name+'</h3><div class="prob-line">'+r.chance+'% <span>win chance of model favorite</span></div><p><strong>'+r.name+' ('+r.fav+')</strong> is favored over '+r.other+' ('+r.otherParty+').</p><p><strong>Race rating:</strong> '+r.rating+'. This is a win probability, not expected vote share.</p><a href="'+r.url+'" target="_blank" rel="noopener">Full forecast and candidate polling ↗</a>';
}
function raceCard(r){
 var left=r.chance,right=100-r.chance,party2=r.otherParty||"I",name=r.district||stateName(r.state)+" Senate";
 return '<article class="race-card"><div class="race-head"><strong>'+name+'</strong><span>'+r.rating.toUpperCase()+'</span></div><div class="race-names"><b>'+r.name+' ('+r.fav+')</b><span>'+left+'% favorite</span></div><div class="race-progress" role="img" aria-label="'+r.name+' '+left+' percent win probability, '+r.other+' '+right+' percent"><span style="width:'+left+'%;background:'+partyColors[r.fav]+'"></span><span style="width:'+right+'%;background:'+partyColors[party2]+'"></span></div><div class="race-foot"><span>'+r.other+' ('+party2+') · '+right+'%</span><a href="'+r.url+'" target="_blank" rel="noopener">DDHQ source ↗</a></div></article>';
}
function renderRaces(){
 var q=$("race-search").value.toLowerCase().trim(),list=(activeView==="senate"?data.senate:data.house);
 var match=list.filter(function(r){return (r.state+" "+(r.district||"")+" "+stateName(r.state)+" "+r.name+" "+r.other).toLowerCase().includes(q);});
 $("race-list").innerHTML=match.length?match.map(raceCard).join(""):'<p>No verified race in this subset matches that search.</p>';
}
function signed(n){return n>0?"+"+n:n===0?"0":String(n);}
function scenario(){
 var h=Number($("house-shift").value),s=Number($("senate-shift").value),hd=241+h,sd=52+s;
 $("house-shift-label").textContent=signed(h)+" seats";
 $("senate-shift-label").textContent=signed(s)+" seats";
 $("scenario-house-seats").textContent=hd+" D — "+(435-hd)+" R";
 $("scenario-senate-seats").textContent=sd+" D caucus — "+(100-sd)+" R";
 $("scenario-house-control").textContent=hd>=218?"Democratic majority":"Republican majority";
 $("scenario-senate-control").textContent=sd>=51?"Democratic majority":"Republican control (including 50–50 tie)";
}
function init(){
 countdown();setInterval(countdown,60000);
 ["house-shift","senate-shift"].forEach(function(id){$(id).addEventListener("input",scenario);});
 document.querySelectorAll("[data-house]").forEach(function(button){
  button.addEventListener("click",function(){$("house-shift").value=button.dataset.house;$("senate-shift").value=button.dataset.senate;scenario();});
 });
 scenario();
 document.querySelectorAll("[data-race-view]").forEach(function(button){button.addEventListener("click",function(){
  activeView=button.dataset.raceView;document.querySelectorAll("[data-race-view]").forEach(function(b){var active=b===button;b.classList.toggle("active",active);b.setAttribute("aria-pressed",active?"true":"false");});renderRaces();
 });});
 $("race-search").addEventListener("input",renderRaces);
 [["show-senate","senate"],["show-governors","governors"]].forEach(function(pair){$(pair[0]).addEventListener("click",function(){
  activeMap=pair[1];selectedState=null;[["show-senate","senate"],["show-governors","governors"]].forEach(function(item){var b=$(item[0]),isActive=item[1]===activeMap;b.classList.toggle("active",isActive);b.setAttribute("aria-pressed",isActive?"true":"false");});renderMap();
 });});
 fetch("politics-data.json?v=20261101",{cache:"no-store"}).then(function(response){if(!response.ok)throw Error("Data unavailable");return response.json();}).then(function(json){
  if(!Array.isArray(json.states)||json.states.length!==50||!Array.isArray(json.senate)||json.senate.length===0)throw Error("Invalid election dataset");
  data=json;renderMap();renderRaces();
 }).catch(function(err){
  $("state-map").textContent="The map data could not be loaded. Please try reloading.";
  $("race-list").textContent="The race detail feed could not be loaded. Use the linked original forecasts above.";
  $("state-detail").innerHTML="<h3>Data unavailable</h3><p>The edition's dated source tables could not be loaded. No state forecast is being assumed.</p>";
  if(window.console)console.warn("Politics desk:",err);
 });
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})();
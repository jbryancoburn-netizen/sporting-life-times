/* Political Life & Times: direct state-reported votes via Open America.
   Never infer calls, certification, zero votes, or statewide totals from missing seats. */
(()=>{"use strict";
const root=document.getElementById("election-night-results");if(!root)return;
const feed="https://openamerica.io/elections/results.json?year=2026&office=";
const offices=["House","Senate","Governor"];
const params=new URLSearchParams(location.search);
const district=(params.get("district")||"").toUpperCase();
const stateSelect=document.getElementById("result-state");
let selected=offices.find(office=>office.toLowerCase()===params.get("office")?.toLowerCase())||"Senate";
let latest={},unavailable={},busy=false,districtFilter=/^[A-Z]{2}-\d{2}$/.test(district)?district:"";
const el=(tag,cls,t)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(t!==undefined)n.textContent=String(t);return n};
const fmt=v=>Number(v).toLocaleString("en-US");
const stateNames={"AK":"Alaska","AL":"Alabama","AR":"Arkansas","AZ":"Arizona","CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware","FL":"Florida","GA":"Georgia","HI":"Hawaii","IA":"Iowa","ID":"Idaho","IL":"Illinois","IN":"Indiana","KS":"Kansas","KY":"Kentucky","LA":"Louisiana","MA":"Massachusetts","MD":"Maryland","ME":"Maine","MI":"Michigan","MN":"Minnesota","MO":"Missouri","MS":"Mississippi","MT":"Montana","NC":"North Carolina","ND":"North Dakota","NE":"Nebraska","NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NV":"Nevada","NY":"New York","OH":"Ohio","OK":"Oklahoma","OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina","SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah","VA":"Virginia","VT":"Vermont","WA":"Washington","WI":"Wisconsin","WV":"West Virginia","WY":"Wyoming"};
const isObject=x=>x&&typeof x==="object"&&!Array.isArray(x);
function valid(d,office){return d?.api===1&&d.year===2026&&d.office?.toLowerCase()===office.toLowerCase()&&isObject(d.races)}
function name(key,office){const state=key.slice(0,2).toUpperCase();const s=stateNames[state]||state;
 if(office==="House"){const cd=key.split("-")[1];return s+" · "+(cd==="00"?"At-large":"District "+Number(cd))}
 return s+(key.toLowerCase().includes("special")?" · Special election":"")}
function card(key,r,office,at){
 const art=el("article","election-ledger-race"),heading=el("div","election-ledger-race-head");
 heading.append(el("strong",null,name(key,office)),el("span",null,"REPORTED VOTES"));art.append(heading);
 const cands=Array.isArray(r.cands)?r.cands.filter(c=>typeof c.n==="string"&&Number.isInteger(c.v)&&c.v>=0):[];
 if(!cands.length){art.append(el("p",null,"No verified candidate totals."));return art}
 const count=cands.reduce((s,c)=>s+c.v,0);
 cands.sort((a,b)=>b.v-a.v);
 for(const c of cands){const row=el("div","election-ledger-candidate");
 row.append(el("span",null,c.n+" · "+(c.p||"Other")),el("strong",null,fmt(c.v)),el("small",null,count?(100*c.v/count).toFixed(1)+"%":"—"));art.append(row)}
 const pct=typeof r.pct_in==="number"&&r.pct_in>=0&&r.pct_in<=100?r.pct_in.toFixed(1)+"% reporting (state-defined units)":"Reporting progress unavailable";
 art.append(el("p","election-ledger-foot",pct+" · Unofficial vote totals · "+(at?new Date(at).toLocaleString():"time not supplied")));
 if(office==="House"&&/^[A-Z]{2}-\d{2}$/.test(key)){const a=el("a",null,"Read district edition ↗");a.href="politics-house-district.html?district="+encodeURIComponent(key);art.append(a)}
 return art;
}
function render(){
 const d=latest[selected],body=document.getElementById("election-ledger-content"),status=document.getElementById("election-ledger-status");
 if(!body||!status)return;body.replaceChildren();
 for(const b of root.querySelectorAll("[data-office]")){b.setAttribute("aria-pressed",String(b.dataset.office===selected))}

 if(!d){status.textContent=unavailable[selected]?selected+" results feed is temporarily unavailable.":"Checking "+selected+" vote reports…";return}
 const keys=Object.keys(d.races).filter(k=>(!stateSelect.value||k.slice(0,2).toUpperCase()===stateSelect.value)&&(!districtFilter||selected!=="House"||k.toUpperCase()===districtFilter)&&isObject(d.races[k])&&Array.isArray(d.races[k].cands)&&d.races[k].cands.some(c=>Number.isInteger(c.v)&&c.v>0));
 const updated=d.as_of&&Number.isFinite(Date.parse(d.as_of))?d.as_of:null;
 status.textContent=keys.length+" "+(districtFilter&&selected==="House"?districtFilter+" ":stateSelect.value?stateNames[stateSelect.value]+" ":"")+selected.toLowerCase()+" races with reported votes in available states · "+(updated?"latest state update "+new Date(updated).toLocaleString():"no state update time")+" · "+(unavailable[selected]?"REFRESH FAILED · LAST AVAILABLE COUNTS":d.stale?"FEED STALE":"STATE REPORTED COUNTS");
 if(!keys.length){body.append(el("p","election-ledger-empty","No verified vote totals yet in this provider's covered states. This is not a nationwide zero count."));return}
 const grid=el("div","election-ledger-grid");for(const key of keys.sort()){grid.append(card(key,d.races[key],selected,updated))}
 body.append(grid);
}
async function refresh(){
 if(busy)return;busy=true;
 try{await Promise.all(offices.map(async office=>{try{
 const resp=await fetch(feed+encodeURIComponent(office),{cache:"no-store",credentials:"omit",signal:AbortSignal.timeout(10000)});
 if(!resp.ok)throw Error("HTTP "+resp.status);
 const data=await resp.json();if(!valid(data,office))throw Error("Unexpected API response");
 latest[office]=data;unavailable[office]=false;
 }catch(e){unavailable[office]=true;console.warn("Election source unavailable",office,e)}}));render()}
 finally{busy=false}
}
root.querySelectorAll("[data-office]").forEach(b=>b.addEventListener("click",()=>{selected=b.dataset.office;render()}));
for(const [code,label] of Object.entries(stateNames).sort((a,b)=>a[1].localeCompare(b[1]))){stateSelect.add(new Option(label,code))}
const initialState=districtFilter.slice(0,2)||(params.get("state")||"").toUpperCase();
if(Object.hasOwn(stateNames,initialState))stateSelect.value=initialState;
stateSelect.addEventListener("change",()=>{districtFilter="";render()});
if(districtFilter){
 const clear=el("button",null,"Show all districts in "+(stateNames[initialState]||initialState));
 clear.type="button";
 document.querySelector(".election-ledger-controls").append(clear);
 clear.addEventListener("click",()=>{districtFilter="";clear.remove();render()});
 stateSelect.addEventListener("change",()=>clear.remove(),{once:true});
}
refresh();setInterval(()=>{if(!document.hidden)refresh()},60000);
})();
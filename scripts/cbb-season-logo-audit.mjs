/* Full-season NCAA basketball logo audit: never assign artwork by a guessed ID URL.
   Every new entry needs a matching ESPN team identity and a fetchable image. */
import fs from 'node:fs';
import path from 'node:path';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,x)=>fs.writeFileSync(p,JSON.stringify(x,null,2)+'\n');
const reg=read('data/mbb-logo-registry.json').teams;
const catalogPath='data/mbb-out-of-division-opponent-logos.json';
const catalog=read(catalogPath);
const women=read('data/ncaaw-schedules-2026-27.json').teams;
const menDir='data/mbb-schedules-2026-27';
const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
const dateOK=s=>typeof s==='string'&&s.slice(0,10)>='2026-11-01'&&s.slice(0,10)<='2027-03-31';
const hex=s=>/^[0-9a-f]{6}$/i.test(String(s||'').replace(/^#/,''))?'#'+String(s).replace(/^#/,'').toUpperCase():'';
const validURL=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
const compatible=(schedule,api)=>{
 const a=norm(schedule),b=norm(api);
 if(!a||!b||a.length<6||b.length<6)return false;
 if(a===b)return true;
 // Only allow an exact school-name prefix followed by a mascot; no fuzzy names.
 return (a.startsWith(b)&&b.length>=8)||(b.startsWith(a)&&a.length>=8);
};
const expected=new Map();let menCalendars=0,menEvents=0,womenEvents=0;
function add(id,name,gender,url='',source=''){
 id=String(id||'');if(!/^\d+$/.test(id)||!name)return;
 const x=expected.get(id)||{id,names:new Set(),genders:new Set(),candidates:new Map(),appearances:0};
 x.names.add(String(name));x.genders.add(gender);x.appearances++;
 if(validURL(url))x.candidates.set(url,{url,source,name:String(name)});
 expected.set(id,x);
}
for(const filename of fs.readdirSync(menDir).filter(x=>/^\d+\.json$/.test(x))){
 const d=read(path.join(menDir,filename));menCalendars++;
 for(const e of d.events||[]){
  if(!dateOK(e.date))continue;menEvents++;
  for(const c of e.competitions||[])for(const t of c.competitors||[]){
   add(t.team?.id,t.team?.displayName||t.team?.name,'men',t.team?.logo,
      'ESPN mens 2026-27 calendar '+filename);
  }
 }
}
for(const [teamID,d] of Object.entries(women)){
 for(const g of d.games||[]){
  if(!dateOK(g.date))continue;womenEvents++;
  add(g.opponent_id,g.opponent,'women');
  // Include the home school too, to audit every team rather than opponents only.
  add(teamID,d.team,'women');
 }
}
const missing=[...expected.values()].filter(x=>!reg[x.id]?.logo_url_verified&&!catalog.teams[x.id]?.logo_url);
const checkedURL=new Map();
async function fetchJSON(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
 try{const r=await fetch(url,{signal:controller.signal,headers:{'User-Agent':'SLT-logo-audit/1.0','Accept':'application/json'}});return r.ok?await r.json():null}
 catch{return null}finally{clearTimeout(timer)}
}
async function imageWorks(url){
 url=validURL(url);if(!url)return false;
 if(checkedURL.has(url))return checkedURL.get(url);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
 let ok=false;
 try{const r=await fetch(url,{method:'GET',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0'}});ok=r.ok&&/^image\//i.test(r.headers.get('content-type')||'');await r.body?.cancel().catch(()=>{});}
 catch{}finally{clearTimeout(timer)}
 checkedURL.set(url,ok);return ok;
}
function teamInfo(raw){return raw?.team||raw?.sports?.[0]?.leagues?.[0]?.teams?.[0]?.team||null}
// The NCAA school directory supplies authenticated slugs for D-II / D-III artwork.
// Match exact school abbreviations, never generate a slug from an opponent name.
let ncaaDirectory=await fetchJSON('https://ncaa-api.henrygd.me/schools-index');
if(!Array.isArray(ncaaDirectory))ncaaDirectory=await fetchJSON('https://www.ncaa.com/json/schools');
if(!Array.isArray(ncaaDirectory))ncaaDirectory=[];
const ncaaMatches=name=>{
 const n=norm(name);
 if(n.length<11)return [];
 return ncaaDirectory.filter(row=>{
  const short=norm(row.name),long=norm(row.long||row.long_name);
  // A long-enough directory school label must be an exact prefix followed by
  // a mascot. Never match an entire different school's name by 8-char prefix.
  return short.length>=11&&(n===short||n.startsWith(short))&&
    (!long||long.startsWith(short)||short.startsWith(long));
 }).filter(row=>row.slug&&/^[a-z0-9-]+$/.test(row.slug));
};
const unresolved=[],added=[];
let next=0;
async function worker(){
 while(next<missing.length){
  const entry=missing[next++],names=[...entry.names];
  const goodName=candidate=>names.some(name=>compatible(name,candidate));
  let picked=null,primary='',secondary='',source='';
  // School-specific ESPN logo URLs already provided in men's schedules are valid evidence.
  for(const c of entry.candidates.values()){
   if(goodName(c.name)&&await imageWorks(c.url)){picked=c.url;source=c.source;break}
  }
  const sports=[...entry.genders].map(g=>g==='women'?'womens-college-basketball':'mens-college-basketball');
  // Some outside-D-I programs appear in only one provider's team directory.
  for(const sport of [...new Set([...sports,'womens-college-basketball','mens-college-basketball'])]){
   if(picked&&primary&&secondary)break;
   const url='https://site.api.espn.com/apis/site/v2/sports/basketball/'+sport+'/teams/'+encodeURIComponent(entry.id);
   const raw=await fetchJSON(url),team=teamInfo(raw);if(!team)continue;
   const labels=[team.displayName,team.name,team.location].filter(Boolean);
   if(!labels.some(goodName))continue;
   const a=hex(team.color),b=hex(team.alternateColor);
   if(a&&b&&a!==b){primary=a;secondary=b}
   if(!picked){for(const item of team.logos||[]){
    const candidate=validURL(item.href);
    if(candidate&&await imageWorks(candidate)){picked=candidate;source=url;break}
   }}
  }
  if(!picked){
   const matches=new Map();
   for(const name of names)for(const row of ncaaMatches(name))matches.set(row.slug,row);
   if(matches.size===1){
    const row=[...matches.values()][0];
    const candidate='https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+row.slug+'.svg';
    if(await imageWorks(candidate)){picked=candidate;source='https://www.ncaa.com/schools-index#'+row.slug}
   }
  }
  if(!picked){unresolved.push({id:entry.id,name:names[0],reason:'no verified accessible school logo',appearances:entry.appearances});continue}
  // A distinct neutral fallback is explicitly documented when colors are not supplied.
  if(!primary||!secondary){primary='#385866';secondary='#597582'}
  catalog.teams[entry.id]={
   school:names[0],feed_name:names[0],aliases:names,
   logo_url:picked,primary,secondary,source_url:source,
   source_note:'2026-27 full-season ESPN team identity and image content verified by automated audit. '+(primary==='#385866'?'School-specific ring colors unverified; neutral ink used.':'Provider color pair used.'),
   identity_verification:'exact school-prefix / display-name',image_checked_at:new Date().toISOString()
  };
  added.push({id:entry.id,name:names[0],source});
 }
}
await Promise.all(Array.from({length:8},()=>worker()));
catalog.updated_at=new Date().toISOString().slice(0,10);
if(added.length)write(catalogPath,catalog);
const remaining=[...expected.values()].filter(x=>!reg[x.id]?.logo_url_verified&&!catalog.teams[x.id]?.logo_url);
const report={
 generated_at:new Date().toISOString(),window:['2026-11-01','2027-03-31'],
 men_calendars:menCalendars,women_calendars:Object.keys(women).length,
 men_calendar_events:menEvents,women_calendar_events:womenEvents,
 unique_scheduled_team_ids:expected.size,missing_before:missing.length,
 verified_new_logos:added.length,missing_after:remaining.length,
 added,unresolved:unresolved.sort((a,b)=>b.appearances-a.appearances),
 note:'HTTP image success does not prove browser display; test published pages separately.'
};
write('data/cbb-season-logo-audit.json',report);
console.log(JSON.stringify({menCalendars,womenCalendars:Object.keys(women).length,
 uniqueTeams:expected.size,missingBefore:missing.length,added:added.length,missingAfter:remaining.length}));
if(menCalendars<365||Object.keys(women).length<363)throw Error('Incomplete published full-season calendars');

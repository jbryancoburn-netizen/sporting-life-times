#!/usr/bin/env node
/**
 * NCAA Division III basketball evidence ledger and independent season-reset Elo.
 * Men/women remain isolated. Official NCAA DIII scoreboard first; NCAA mirror fallback.
 * A DIII scoreboard appearance alone is NOT proof that both opponents are DIII.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const ROOT=process.cwd(), DATA=path.join(ROOT,'data');
const SEASON='2026-27', START='2026-10-15', END='2027-04-15';
const HASH='7287cda610a9326931931080cb3a604828febe6fe3c9016a7e4a36db99efdb7c';
const K=24, HOME=65; // PROVISIONAL; do not claim historical calibration.
const slug=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const validScore=x=>x!==''&&x!==null&&x!==undefined&&Number.isInteger(Number(x))&&Number(x)>=0;
const iso=d=>d.toISOString().slice(0,10);
const day=s=>new Date(s+'T12:00:00Z');
const addDays=(s,n)=>iso(new Date(day(s).getTime()+n*86400000));
const isD3=t=>['3','d3','iii','division iii'].includes(String(t?.division??t?.divisionCode??t?.teamDivision??'').trim().toLowerCase());
const extractTeam=t=>{
  const names=t?.names||{}, name=t?.nameShort||names.full||names.short||t?.name||'';
  const rawId=t?.seoname||names.seo||t?.teamId||slug(name);
  const conf=Array.isArray(t?.conferences)?t.conferences[0]?.conferenceName||'':'';
  return {id:slug(rawId),name:String(name),slug:slug(t?.seoname||names.seo||''),conference:conf,d3_confirmed:isD3(t),
    identity_source:'NCAA game scoreboard'};
};
const statusOf=c=>{
  const s=String(c.gameState||c.status||'').toLowerCase();
  if(['f','final','post'].includes(s))return 'final';
  if(['i','live','in'].includes(s))return 'live';
  return 'scheduled';
};
const etTime=value=>{
  if(!value)return '';
  const stamp=Date.parse(value);
  if(Number.isNaN(stamp)||!/T/.test(value))return String(value);
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(stamp))+' ET';
};
function gameRecord(raw, date, gender, source){
  let away,home,rawA,rawH;
  if(source==='NCAA GraphQL'){
    const teams=raw.teams||[];
    rawA=teams.find(t=>t?.isHome===false);rawH=teams.find(t=>t?.isHome===true);
    if(!rawA||!rawH)return null;
  }else{
    rawA=raw.away;rawH=raw.home;
    if(!rawA||!rawH)return null;
  }
  away=extractTeam(rawA); home=extractTeam(rawH);
  if(!away.id||!home.id||away.id===home.id||!away.name||!home.name)return null;
  const as=rawA.score, hs=rawH.score;
  let status=statusOf(raw);
  if(status==='final'&&(!validScore(as)||!validScore(hs)||Number(as)===Number(hs)))status='unverified';
  const sourceId=String(raw.contestId||raw.gameID||raw.id||'').trim();
  const id=sourceId?gender+'-'+sourceId:gender+'-'+date+'-'+away.id+'-'+home.id;
  const url=typeof raw.url==='string'&&raw.url.startsWith('https://')?raw.url:
     typeof raw.url==='string'&&raw.url.startsWith('/')?'https://www.ncaa.com'+raw.url:
     /^\d+$/.test(sourceId)?'https://www.ncaa.com/game/'+sourceId:'';
  const neutral=raw.neutralSite===true||raw.isNeutralSite===true||raw.isNeutral===true;
  return {game:{id,date,away:away.id,home:home.id,status,away_score:validScore(as)?Number(as):null,
    home_score:validScore(hs)?Number(hs):null,start_time:etTime(raw.startTime),source_url:url,
    source_provider:source,network:raw.broadcasterName||raw.network||'',neutral,
    elo_eligible:away.d3_confirmed&&home.d3_confirmed},teams:[away,home]};
}
async function jsonAt(url){
  const r=await fetch(url,{headers:{'User-Agent':'SportingLifeTimes/1.0 (public NCAA scoreboard)','Accept':'application/json'},
    signal:AbortSignal.timeout(16000)});
  if(!r.ok)throw Error('HTTP '+r.status);
  const v=await r.json();if(!v||typeof v!=='object'||v.errors)throw Error('Invalid scoreboard response');
  return v;
}
async function fetchDay(gender,date){
  const params={sportCode:gender==='men'?'MBB':'WBB',division:3,
    seasonYear:Number(date.slice(0,4))+(Number(date.slice(5,7))>=7?1:0),contestDate:date.replace(/-/g,'/')};
  const graphql='https://sdataprod.ncaa.com/?'+new URLSearchParams({
    extensions:JSON.stringify({persistedQuery:{version:1,sha256Hash:HASH}}),
    variables:JSON.stringify(params)}).toString();
  const mirror='https://ncaa-api.henrygd.me/scoreboard/basketball-'+gender+'/d3/'+date.replace(/-/g,'/')+'/all-conf';
  const errors=[];
  for(const [label,url] of [['NCAA GraphQL',graphql],['NCAA scoreboard mirror',mirror]]){
    try{
      const raw=await jsonAt(url);
      const contents=label==='NCAA GraphQL'?raw?.data?.contests:raw.games;
      if(!Array.isArray(contents))throw Error('Missing games array');
      const parsed=contents.map(x=>gameRecord(label==='NCAA GraphQL'?x:(x.game||x),date,gender,label)).filter(Boolean);
      return {date,source:label,items:parsed};
    }catch(err){errors.push(label+': '+String(err.message||err).slice(0,95));}
  }
  return {date,error:errors.join(' | '),items:[]};
}
function rating(teams,games){
  for(const t of teams.values()){t.elo=1500;t.w=0;t.l=0;t.games_rated=0;}
  const finals=games.filter(g=>g.status==='final'&&g.elo_eligible&&
    validScore(g.away_score)&&validScore(g.home_score)&&g.away_score!==g.home_score)
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.start_time).localeCompare(String(b.start_time))||
      a.id.localeCompare(b.id));
  for(const g of finals){
    const a=teams.get(g.away),h=teams.get(g.home);
    if(!a||!h||!a.d3_confirmed||!h.d3_confirmed)continue;
    const expect=1/(1+10**((a.elo-h.elo-HOME*(g.neutral?0:1))/400));
    const homeWin=g.home_score>g.away_score?1:0;
    g.pregame_elo_home=Number(h.elo.toFixed(1));g.pregame_elo_away=Number(a.elo.toFixed(1));
    g.pred_home_pct=Number((100*expect).toFixed(1));
    const change=K*(homeWin-expect);
    h.elo+=change;a.elo-=change;
    h.games_rated++;a.games_rated++;
    if(homeWin){h.w++;a.l++;}else{a.w++;h.l++;}
  }
  for(const t of teams.values())t.elo=Number(t.elo.toFixed(1));
  return finals.length;
}
/**
 * NCAA member directory, 2026–27 sport sponsorship (not a projected total).
 * The public directory web page loads this JSON route through DataTables.
 * Use stable official organization IDs as provenance; do not borrow DI indices.
 */
async function officialDirectory(gender){
  const code=gender==='men'?'MBB':'WBB';
  const url='https://web3.ncaa.org/directory/api/directory/memberList?type=12&division=III&sportCode='+code;
  try{
    const records=await jsonAt(url);
    if(!Array.isArray(records))throw Error('NCAA directory returned a non-list document');
    const min=gender==='men'?380:390,max=gender==='men'?420:430;
    if(records.length<min||records.length>max)
      throw Error('NCAA directory size outside audited DIII '+gender+' safety range: '+records.length);
    const teams=new Map(),orgIds=new Set();
    for(const row of records){
      if(Number(row.division)!==3||Number(row.academicYear)!==2027||String(row.deactive||'N')!=='N')
        throw Error('Wrong division, academic year or inactive member in NCAA directory');
      const orgId=Number(row.orgId),name=String(row.nameOfficial||'').trim();
      if(!Number.isSafeInteger(orgId)||orgId<=0||name.length<4)
        throw Error('NCAA directory missing official organization identity');
      const id=slug(name);
      if(teams.has(id)||orgIds.has(orgId))throw Error('Ambiguous NCAA institution name or duplicate organization ID: '+name);
      orgIds.add(orgId);
      const athletics=String(row.athleticWebUrl||'').trim().replace(/^https?:\/\//,'');
      teams.set(id,{
        id,name,slug:'',conference:String(row.sportConferenceName||row.conferenceName||'').trim(),
        conference_id:Number(row.sportConferenceId||row.conferenceId)||null,
        state:String(row.memberOrgAddress?.state||''),
        ncaa_org_id:orgId,d3_confirmed:true,athletics_site:athletics&&/^[\w.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(athletics)?'https://'+athletics:'',
        membership_source:url,membership_year:2027,
        provisional_member:row.provisionalMember===true,
        identity_source:'NCAA official 2026–27 Division III basketball sport sponsorship'});
    }
    const values=[...teams.values()];
    const anchors=values.filter(t=>['adrian-college','albion-college','babson-college','trine-university',
      'amherst-college','williams-college','johns-hopkins-university'].includes(t.id));
    if(anchors.length<4)throw Error('Official NCAA basketball directory failed known DIII identity checks');
    return {teams:values,source:url,error:null};
  }catch(e){return {teams:[],source:url,error:String(e.message||e).slice(0,230)};}
}
function identityKey(x){
  return String(x||'').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'')
    .replace(/\b(?:university|college|the|of|at)\b/g,'').replace(/[^a-z0-9]/g,'');
}

function rebuild(gender,previous,results,additionalTeams=[]){
  const teams=new Map((previous.teams||[]).filter(x=>x.d3_confirmed||!/ESPN Division III basketball group 52/.test(x.identity_source||'')).map(x=>[x.id,{...x}]));
  // Only the NCAA's year-specific sponsorship roster may establish a team as
  // an officially verified current DIII program.
  for(const t of additionalTeams){
    const old=teams.get(t.id);
    teams.set(t.id,{...old,...t,d3_confirmed:true});
  }
  const byKey=new Map();
  for(const t of teams.values()){
    if(!t.membership_source||t.membership_year!==2027)continue;
    const key=identityKey(t.name);
    if(!key)continue;
    const arr=byKey.get(key)||[];
    arr.push(t.id);byKey.set(key,arr);
  }
  function reconcile(team){
    const key=identityKey(team.name);
    const ids=byKey.get(key)||[];
    if(ids.length!==1)return team;
    const official=teams.get(ids[0]);
    if(!official)return team;
    return {...team,id:official.id,d3_confirmed:true,
      name:official.name,conference:official.conference,
      ncaa_org_id:official.ncaa_org_id,identity_source:official.identity_source};
  }
  const games=new Map((previous.games||[]).map(g=>[g.id,{...g}]));
  for(const result of results){
    for(const {game,teams:pair} of result.items){
      const merged=pair.map(reconcile);
      if(merged[0].id===merged[1].id)continue;
      for(const t of merged){
        const old=teams.get(t.id);
        teams.set(t.id,{...old,...t,d3_confirmed:!!(old?.d3_confirmed||t.d3_confirmed),
          name:old?.membership_source?old.name:t.name,
          conference:old?.membership_source?old.conference:(t.conference||old?.conference||''),
          slug:t.slug||old?.slug||''});
      }
      const updated={...game,away:merged[0].id,home:merged[1].id};
      const old=games.get(game.id);
      if(old?.status==='final'&&updated.status!=='final')continue;
      games.set(game.id,{...old,...updated});
    }
  }
  // Prior published contest rows keep their proven eligibility; merely seeing
  // another team in a DIII scoreboard never promotes a cross-division match.
  const list=[...games.values()];
  for(const g of list)g.elo_eligible=!!(teams.get(g.away)?.d3_confirmed&&teams.get(g.home)?.d3_confirmed);
  const rated=rating(teams,list);
  const errors=results.filter(x=>x.error).map(x=>({date:x.date,error:x.error}));
  const scanned=results.filter(x=>!x.error).map(x=>x.date);
  const validFixtures=list.filter(g=>g.status!=='unverified').length;
  return {schema_version:1,division:'d3',gender,season:SEASON,starting_elo:1500,
    as_of:new Date().toISOString(),source:'NCAA DIII official scoreboard; mirror only if official unavailable',
    model:{k:K,home_elo_edge:HOME,status:'Provisional parameters; no DIII historical calibration claimed'},
    coverage:{discovered_teams:teams.size,confirmed_d3_teams:[...teams.values()].filter(t=>t.d3_confirmed).length,
      published_games:list.length,valid_fixtures:validFixtures,eligible_finals:rated,
      scanned_days:scanned.length,failed_days:errors,full_school_calendar_audit:false,
      membership_certified:false,
      note:'Games are not a complete school-by-school schedule. Only both explicitly DIII-confirmed opponents enter Elo.'},
    teams:[...teams.values()].sort((a,b)=>a.name.localeCompare(b.name)),
    games:list.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))};
}
async function run(gender,deep=false){
  fs.mkdirSync(DATA,{recursive:true});
  const file=path.join(DATA,'d3-'+gender+'-2026-27.json');
  const previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{teams:[],games:[]};
  const today=iso(new Date()),start=deep||!previous.coverage?.scanned_days?START:addDays(today,-7);
  const end=addDays(today,deep?21:8),dates=[];
  for(let d=start;d<=end&&d<=END;d=addDays(d,1))dates.push(d);
  const results=[];
  for(let i=0;i<dates.length;i+=3){
    const batch=await Promise.all(dates.slice(i,i+3).map(d=>fetchDay(gender,d)));
    results.push(...batch);
    await new Promise(resolve=>setTimeout(resolve,400));
  }
  const successful=results.filter(r=>!r.error).length;
  if(!successful)throw Error('All NCAA DIII '+gender+' scoreboards failed: retaining previous publication');
  const directory=await officialDirectory(gender);
  const next=rebuild(gender,previous,results,directory.teams);
  const official=next.teams.filter(t=>t.membership_source&&t.membership_year===2027);
  const target=gender==='men'?407:416;
  next.coverage.membership_certified=!directory.error;
  next.coverage.official_directory_count=official.length;
  next.coverage.ncaa_projected_programs=target;
  next.coverage.official_vs_projection_gap=target-official.length;
  next.coverage.directory_source=directory.source;
  next.coverage.directory_status=directory.error?
    'NCAA 2026–27 directory fetch failed: '+directory.error+'; retaining previously certified membership':
    'NCAA official 2026–27 '+gender+' DIII basketball sponsors: '+official.length+
      ' (NCAA July projection '+target+'; reconciliation difference '+(target-official.length)+')';
  fs.writeFileSync(file,JSON.stringify(next,null,2)+'\n');
  console.log(gender+': '+next.teams.length+' discovered; '+next.games.length+' fixtures; '+next.coverage.eligible_finals+
    ' Elo finals; '+successful+'/'+dates.length+' days read; '+next.coverage.failed_days.length+' failed days');
}
function selftest(){
  const t=(id)=>({id,name:id,d3_confirmed:true});
  const game={id:'a',date:'2026-11-10',away:'a',home:'b',status:'final',away_score:75,home_score:70,elo_eligible:true};
  const d=rebuild('men',{teams:[],games:[]},[{date:game.date,items:[{game,teams:[t('a'),t('b')]}]}]);
  assert.equal(d.coverage.eligible_finals,1);
  assert.equal(d.teams.reduce((n,t)=>n+t.elo,0),3000);
  const cross=rebuild('women',{teams:[],games:[]},[{date:game.date,items:[{game,teams:[t('a'),{...t('b'),d3_confirmed:false}]}]}]);
  assert.equal(cross.coverage.eligible_finals,0);
  assert.equal(cross.teams.find(t=>t.id==='a').elo,1500);
  assert.equal(gameRecord({teams:[{isHome:false,nameShort:'A',seoname:'a',division:3,score:77},
    {isHome:true,nameShort:'B',seoname:'b',division:3,score:72}],gameState:'F',contestId:123},
    '2026-11-10','men','NCAA GraphQL').game.elo_eligible,true);
  const officialTeam={id:'trine-university',name:'Trine University',d3_confirmed:true,
    membership_year:2027,membership_source:'https://web3.ncaa.org/directory/api/directory/memberList',
    conference:'Michigan Intercollegiate Athletic Association'};
  const officialAway={...officialTeam,id:'hope-college',name:'Hope College'};
  const short=(id,name)=>({id,name,conference:'',d3_confirmed:false});
  const aliasGame={id:'verified-1',date:'2026-11-06',status:'final',
    away:'hope',home:'trine',away_score:64,home_score:70};
  const linked=rebuild('men',{teams:[],games:[]},
    [{date:'2026-11-06',items:[{game:aliasGame,teams:[short('hope','Hope'),short('trine','Trine')]}]}],
    [officialTeam,officialAway]);
  assert.equal(linked.coverage.eligible_finals,1);
  assert.equal(linked.games[0].home,'trine-university');
  assert.equal(linked.games[0].away,'hope-college');
  assert.equal(linked.teams.length,2);
  assert.equal(linked.teams.every(t=>t.d3_confirmed),true);
  console.log('DIII isolated Elo and final-score test passed');
}
if(process.argv.includes('--test'))selftest();
else for(const gender of ['men','women'])await run(gender,process.argv.includes('--deep'));

/* NBL27 shared fixture service: full 165-game fixture survives rolling-scoreboard failures.
 * Secondary fixture candidates are NOT presented as officially certified.
 * ESPN results are added only when a match to an existing scheduled game is found.
 */
(function () {
  'use strict';
  const ROOT='data/';
  const ESPN='https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/scoreboard';
  const formatDay=new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
  const toISO=s=>String(s||'').replace(' ','T');
  const validDate=s=>{const d=new Date(toISO(s));return Number.isFinite(d.getTime())?d:null;};
  function day(s){
    const d=validDate(s);if(!d)return '';
    const v=Object.fromEntries(formatDay.formatToParts(d).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    return v.year+'-'+v.month+'-'+v.day;
  }
  const key=(h,a,d)=>String(h||'').toLowerCase()+'|'+String(a||'').toLowerCase()+'|'+d;
  const get=async file=>{const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw Error(file+' HTTP '+r.status);return r.json();};
  const asNum=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  const ESPNTeam=(x)=>x&&x.team&&x.team.displayName||'';
  function fromEvent(e){
    const c=e.competitions&&e.competitions[0]||{};
    const cs=c.competitors||[];
    const h=cs.find(t=>t.homeAway==='home'),a=cs.find(t=>t.homeAway==='away');
    if(!h||!a||!validDate(e.date))return null;
    return {id:String(e.id),date:e.date,day:day(e.date),home:ESPNTeam(h),away:ESPNTeam(a),
      state:e.status&&e.status.type&&e.status.type.state||'pre',
      home_score:asNum(h.score),away_score:asNum(a.score),
      venue:c.venue&&c.venue.fullName||'',broadcasts:(c.broadcasts||[]).flatMap(b=>b.names||[]),
      url:e.links&&e.links[0]&&e.links[0].href||'',
      status_detail:e.status&&e.status.type&&e.status.type.detail||'',source:'ESPN live scoreboard'};
  }
  function dailyWindow(){
    const now=new Date();
    const ymd=day(now.toISOString());
    const base=Date.parse(ymd+'T12:00:00Z');
    return [-2,-1,0,1,2].map(n=>new Date(base+n*86400000).toISOString().slice(0,10).replace(/-/g,''));
  }
  function applyScore(g,result){
    if(result.state==='post'&&Number.isInteger(result.home_score)&&Number.isInteger(result.away_score)&&result.home_score!==result.away_score){
      g.state='post';g.home_score=result.home_score;g.away_score=result.away_score;
      g.url=result.url||g.url;g.status_detail='Final';g.result_source=result.source;
    }else if(result.state==='in'){
      g.state='in';g.home_score=result.home_score;g.away_score=result.away_score;
      g.url=result.url||g.url;g.status_detail=result.status_detail||'Live';g.result_source=result.source;
    }
  }
  async function load(){
    const [fixtureResult,resultsResult,auditResult]=await Promise.allSettled([
      get(ROOT+'nbl27-season-candidates.json'),get(ROOT+'nbl-research-current-ledger.json'),
      get(ROOT+'nbl27-schedule-audit.json')
    ]);
    if(fixtureResult.status!=='fulfilled')throw Error('The published 2026-27 fixture file is unavailable');
    const raw=fixtureResult.value;
    const candidates=Array.isArray(raw.games)?raw.games:[];
    const games=candidates.filter(g=>validDate(g.date_utc)&&g.home&&g.away).map(g=>{
      const hs=asNum(g.home_score),as=asNum(g.away_score);
      const completed=g.state==='post'&&Number.isInteger(hs)&&Number.isInteger(as)&&hs!==as;
      return {id:String(g.id),date:toISO(g.date_utc),day:day(g.date_utc),
        home:g.home,away:g.away,state:completed?'post':'pre',
        home_score:completed?hs:null,away_score:completed?as:null,
        venue:g.venue||'',broadcasts:Array.isArray(g.broadcasts)?g.broadcasts:[],
        round:g.round||null,url:completed&&/^\\d+$/.test(String(g.id))?'https://www.espn.com/nbl/game/_/gameId/'+g.id:'',
        status_detail:completed?'Final':'Scheduled',fixture_source:g.source||raw.source||'NBL fixture candidate',
        official_verified:g.official_nbl_verified===true};
    });
    const map=new Map(games.map(g=>[key(g.home,g.away,g.day),g]));
    const archived=resultsResult.status==='fulfilled'&&Array.isArray(resultsResult.value.games)?resultsResult.value.games:[];
    let archiveMatches=0;
    for(const r of archived){
      const match=map.get(key(r.home,r.away,day(r.played_at)));
      if(!match||!Number.isInteger(r.home_score)||!Number.isInteger(r.away_score))continue;
      applyScore(match,{...r,state:'post',source:'ESPN published final candidate',url:r.source_url});
      archiveMatches++;
    }
    // Only request individual dates: the previous five multiweek ESPN requests returned HTTP 400.
    // A provider outage never clears or truncates the persistent fixture.
    const recent=await Promise.allSettled(dailyWindow().map(async d=>{
      const r=await fetch(ESPN+'?dates='+d+'&limit=100',{cache:'no-store'});
      if(!r.ok)throw Error('ESPN HTTP '+r.status);
      const j=await r.json();return j.events||[];
    }));
    let liveMatches=0,failedDates=0;
    for(const result of recent){
      if(result.status!=='fulfilled'){failedDates++;continue;}
      for(const event of result.value){
        const r=fromEvent(event);if(!r)continue;
        const match=map.get(key(r.home,r.away,r.day));
        if(match){applyScore(match,r);liveMatches++;}
      }
    }
    games.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    const uniqueTeams=new Set(games.flatMap(g=>[g.home,g.away]));
    const audit=auditResult.status==='fulfilled'?auditResult.value:null;
    return {games,expected:165,clubs:uniqueTeams.size,archiveMatches,liveMatches,failedDates,
      audit,officiallyCertified:false,
      lastLedgerUpdate:resultsResult.status==='fulfilled'?resultsResult.value.updated_at||null:null,
      notice:'Fixture candidates cross-checked against the NBL schedule; independent official certification is pending. Finals are sourced ESPN candidates, not official NBL-certified results.'};
  }
  window.NBLFullSchedule={load,day};
})();

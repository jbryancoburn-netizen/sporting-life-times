/* Sole public 365-team RETRO power ranking: all season openings at 1500. */
(async()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const intl=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'});
const load=async p=>{const url=p+'?edition='+Math.floor(Date.now()/60000);const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(p+' HTTP '+r.status);return r.json();};
let retro=null,cross=null,filter='',conference='',a='',b='',venue='neutral';
const ids=()=>new Map((cross?.teams||[]).map(x=>[x.id,String(x.espn_id)]));
const format=n=>Number.isFinite(Number(n))?Number(n).toFixed(1):'—';
const logo=(t)=>{
 const id=ids().get(t.team_id),ini=esc(t.team.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase());
 return '<span class="cbb-elo-crest" style="--school-color:#176b7d"><i>'+ini+'</i>'+(id?'<img alt="" loading="lazy" decoding="async" src="https://a.espncdn.com/i/teamlogos/ncaa/500/'+encodeURIComponent(id)+'.png" onerror="this.remove()">':'')+'</span>';
};
const link=t=>'ncaam-team.html?team='+encodeURIComponent(t.team_id);
const ranked=()=>retro?.rankings||[];
const rankTag=t=>retro.games_played?(t.rank?'#'+t.rank:'—'):'T–1';
const delta=t=>{if(!retro.games_played)return '<span class="cbb-elo-flat">—</span>';const n=Number(t.daily_change)||0;return '<span class="'+(n>0?'cbb-elo-pos':n<0?'cbb-elo-neg':'cbb-elo-flat')+'">'+(n>0?'▲ +':n<0?'▼ −':'— ')+format(Math.abs(n))+'</span>';};
function renderTable(){
 const q=filter.trim().toLowerCase();
 const teams=ranked().filter(t=>(!q||[t.team,t.conference].join(' ').toLowerCase().includes(q))&&(!conference||t.conference===conference));
 $('cbb-count').textContent=teams.length+' of 365 programs';
 $('cbb-elo-body').innerHTML=teams.map(t=>'<tr><td class="cbb-elo-rank">'+rankTag(t)+'</td><td><a class="cbb-elo-school" href="'+link(t)+'">'+logo(t)+'<span>'+esc(t.team)+'</span></a></td><td>'+esc(t.conference||'—')+'</td><td class="num">'+(t.wins??0)+'–'+(t.losses??0)+'</td><td class="num"><b>'+format(t.elo)+'</b></td><td class="num">'+delta(t)+'</td><td class="num">'+(t.games_played??0)+'</td></tr>').join('');
 if(!teams.length)$('cbb-elo-body').innerHTML='<tr><td colspan="7">No programs match those filters.</td></tr>';
}
function renderMatchup(){
 const A=ranked().find(t=>t.team_id===a),B=ranked().find(t=>t.team_id===b);if(!A||!B)return;
 if(A.team_id===B.team_id){$('cbb-matchup-result').textContent='Select two different programs.';return}
 const edge=venue==='a'?100:venue==='b'?-100:0;
 const p=100/(1+10**(((B.elo||1500)-(A.elo||1500)-edge)/400));
 $('cbb-matchup-result').innerHTML='<div class="cbb-matchup-sides"><strong>'+esc(A.team)+'</strong><b>'+p.toFixed(1)+'% · '+(100-p).toFixed(1)+'%</b><strong>'+esc(B.team)+'</strong></div><div class="cbb-matchup-meter"><span style="width:'+p.toFixed(1)+'%"></span></div><p>Independent 1500-start RETRO estimate. Venue adjustment: '+(venue==='neutral'?'none':venue==='a'?'Team A +100 Elo':'Team B +100 Elo')+'. Early-season estimates have limited game evidence.</p>';
}
function setupMatchups(){
 const options=ranked().slice().sort((x,y)=>x.team.localeCompare(y.team)).map(t=>'<option value="'+esc(t.team_id)+'">'+esc(t.team)+'</option>').join('');
 $('cbb-matchup-a').innerHTML=options;$('cbb-matchup-b').innerHTML=options;
 if(!a)a=ranked().find(x=>x.team==='Indiana')?.team_id||ranked()[0].team_id;
 if(!b)b=ranked().find(x=>x.team==='Purdue')?.team_id||ranked()[1].team_id;
 $('cbb-matchup-a').value=a;$('cbb-matchup-b').value=b;$('cbb-matchup-venue').value=venue;
 renderMatchup();
}
function render(){
 const games=retro.games_played||0;
 $('cbb-elo-meta').textContent=games?games+' verified finals · Results through '+intl.format(new Date(retro.as_of+'T12:00:00Z')):'Preseason edition · All 365 programs begin at 1500';
 $('cbb-elo-model').textContent=games?'LIVE · RETRO 1500':'PRESEASON · RETRO 1500';
 $('cbb-elo-fresh').textContent='Source: verified 2026–27 finals · '+(games?'Last verified game '+retro.as_of:'First ratings change after verified regular-season finals')+' · 365 programs';
 const sorted=[...new Set(ranked().map(t=>t.conference).filter(Boolean))].sort();
 $('cbb-conference').innerHTML='<option value="">All conferences</option>'+sorted.map(c=>'<option value="'+esc(c)+'">'+esc(c)+'</option>').join('');$('cbb-conference').value=conference;
 $('cbb-top-ten').innerHTML=games?ranked().slice(0,10).map((t,i)=>'<a href="'+link(t)+'" class="cbb-elo-power"><span class="cbb-elo-rank">#'+(i+1)+'</span>'+logo(t)+'<span class="cbb-elo-power-name"><strong>'+esc(t.team)+'</strong><small>'+esc(t.conference||'')+'</small></span><b>'+format(t.elo)+'</b></a>').join(''):
 '<div class="cbb-elo-preseason"><strong>365 schools. 365 fresh starts.</strong><p>Everyone opens the season at exactly 1500. Competitive rankings begin only when completed 2026–27 games have been verified.</p></div>';
 renderTable();setupMatchups();
}
async function refresh(){
 try{
  const [next,walk]=await Promise.all([load('data/ncaam-2026-27-retro-primary.json'),cross?Promise.resolve(cross):load('data/ncaam-2026-27-espn-team-crosswalk.json')]);
  if(next.model!=='retro-clean-slate'||next.season!=='2026-27'||next.starting_elo!==1500||next.rankings?.length!==365||new Set(next.rankings.map(t=>t.team_id)).size!==365||next.rankings.some(t=>t.base_elo!==1500||!Number.isFinite(t.elo))||next.events?.length!==next.games_played)throw Error('RETRO ratings failed complete 365-team integrity check');
  const changed=!retro||next.games_played!==retro.games_played||JSON.stringify(next.rankings.map(x=>[x.team_id,x.elo,x.daily_change]))!==JSON.stringify(retro.rankings.map(x=>[x.team_id,x.elo,x.daily_change]));
  retro=next;cross=walk;if(changed)render();
 }catch(e){console.error(e);$('cbb-elo-fresh').textContent='Rankings refresh unavailable: retaining last verified dataset';if(!retro)$('cbb-elo-body').innerHTML='<tr><td colspan="7">Verified 365-team RETRO rankings unavailable. No ratings have been invented.</td></tr>';}
}
$('cbb-search').addEventListener('input',e=>{filter=e.target.value;renderTable();});
$('cbb-conference').addEventListener('change',e=>{conference=e.target.value;renderTable();});
$('cbb-matchup-a').addEventListener('change',e=>{a=e.target.value;renderMatchup()});
$('cbb-matchup-b').addEventListener('change',e=>{b=e.target.value;renderMatchup()});
$('cbb-matchup-venue').addEventListener('change',e=>{venue=e.target.value;renderMatchup()});
await refresh();
setInterval(()=>{if(!document.hidden)refresh();},60000);
})();

/* Verified-match-report performance panel. Shared across all 20 EPL clubs. */
(()=>{'use strict';
const root=document.getElementById('club-performance');
if(!root)return;
const clubIds={'359':'Arsenal','362':'Aston Villa','349':'Bournemouth','337':'Brentford','331':'Brighton','363':'Chelsea','388':'Coventry','384':'Crystal Palace','368':'Everton','370':'Fulham','306':'Hull','373':'Ipswich','357':'Leeds United','364':'Liverpool','382':'Manchester City','360':'Manchester United','361':'Newcastle United','393':"Nott'm Forest",'366':'Sunderland','367':'Tottenham'};
const club=clubIds[new URLSearchParams(location.search).get('club')];
if(!club)return;
const norm=x=>String(x??'').toLowerCase().replace(/[^a-z]/g,'');
const canonical=x=>({
'tottenhamhotspur':'tottenham','nottinghamforest':'nottmforest','afcbournemouth':'bournemouth',
'brightonhovealbion':'brighton','ipswichtown':'ipswich','coventrycity':'coventry','hullcity':'hull'
}[norm(x)]||norm(x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const asNumber=(value,key)=>{
 const raw=String(value??'').trim();
 // Reject composite values (for example "12/17") rather than making up a single statistic.
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)\s*%?$/.test(raw))return null;
 let n=Number(raw.replace('%','').trim());
 if(!Number.isFinite(n))return null;
 if((key==='passPct'||key==='possessionPct')&&!raw.includes('%')&&n>0&&n<=1)n*=100;
 return n;
};
const groups=[
 {name:'Attack',tag:'Creating chances',fields:[['totalShots','Shots per match'],['shotsOnTarget','Shots on target'],['wonCorners','Corners won'],['offsides','Offsides']]},
 {name:'Passing & control',tag:'Keeping the ball',fields:[['possessionPct','Possession','percent'],['totalPasses','Passes per match'],['accuratePasses','Completed passes'],['passPct','Pass completion','percent']]},
 {name:'Defensive actions',tag:'Without the ball',fields:[['effectiveTackles','Successful tackles'],['interceptions','Interceptions'],['totalClearance','Clearances'],['saves','Saves']]}
];
root.innerHTML='<p class="perf-loading">Loading the published match-performance sample…</p>';
fetch('data/epl-match-reports.json',{cache:'no-store'})
.then(r=>{if(!r.ok)throw Error('Report source unavailable');return r.json()})
.then(data=>{
 const byClub=new Map();
 for(const match of Object.values(data.matches||{})){
  for(const team of match.teams||[]){
   if(!Array.isArray(team?.statistics)||!team.statistics.length)continue;
   const id=canonical(team.team);
   if(!byClub.has(id))byClub.set(id,[]);
   const parsed=Object.fromEntries(team.statistics.map(s=>[s.name,asNumber(s.displayValue,s.name)]));
   byClub.get(id).push(parsed);
  }
 }
 const records=byClub.get(canonical(club))||[];
 const mean=(rows,key)=>{
  const values=rows.map(row=>row[key]).filter(Number.isFinite);
  return values.length?{average:values.reduce((a,b)=>a+b,0)/values.length,sample:values.length}:null;
 };
 const measure=(key,label,unit)=>{
  const observed=mean(records,key);
  if(!observed)return '';
  const competitors=[...byClub].map(([name,rows])=>({name,stat:mean(rows,key)})).filter(x=>x.stat!==null)
   .sort((a,b)=>b.stat.average-a.stat.average||a.name.localeCompare(b.name));
  const index=competitors.findIndex(x=>x.name===canonical(club));
  const position=index<0?null:1+competitors.filter(x=>x.stat.average>observed.average).length;
  const top=Math.max(0,...competitors.map(x=>x.stat.average));
  const width=top?Math.max(0,Math.min(100,100*observed.average/top)):0;
  const formatted=observed.average.toFixed(1)+(unit==='percent'?'%':'');
  const rank=position?'<span class="perf-rank" aria-label="Rank '+position+' of '+competitors.length+' covered clubs">#'+position+'</span>':'';
  const unitLabel=unit==='percent'?'Sample share':'Per match';
  return '<div class="perf-metric"><div class="perf-metric-top"><span class="perf-label">'+esc(label)+'</span>'+rank+'</div>'+
   '<div class="perf-metric-value"><strong>'+esc(formatted)+'</strong><span>'+unitLabel+'</span></div>'+
   '<div class="perf-track" role="img" aria-label="'+esc(label)+': '+esc(formatted)+'. Relative to highest observed average in the published report sample"><i style="width:'+width.toFixed(1)+'%"></i></div>'+
   '<p class="perf-context">'+observed.sample+' sourced '+(observed.sample===1?'match':'matches')+' · '+competitors.length+' clubs compared</p></div>';
 };
 const populated=groups.map(g=>({name:g.name,tag:g.tag,html:g.fields.map(f=>measure(...f)).filter(Boolean)}));
 root.innerHTML='<div class="perf-intro"><p class="perf-scope"><strong>'+records.length+' sourced '+(records.length===1?'match report':'match reports')+'</strong> for '+esc(club)+'. Averages and ranks cover only clubs represented in the published match-report sample, not the full Premier League season.</p><p class="perf-legend">The bars compare each average with the highest sampled club; # badges rank the clubs with that statistic available.</p></div>'+
 (records.length?'<div class="perf-categories">'+populated.map(g=>'<section class="perf-category"><div class="perf-category-head"><div><span class="perf-category-kicker">'+esc(g.tag)+'</span><h3>'+esc(g.name)+'</h3></div><span class="perf-category-count">'+g.html.length+' measures</span></div>'+(g.html.length?g.html.join(''):'<p class="perf-empty">Not recorded in this report sample.</p>')+'</section>').join('')+'</div>':'<p class="perf-empty">No verified team performance metrics are available in the current published match reports.</p>');
}).catch(()=>{
 root.innerHTML='<p class="perf-empty">Detailed performance statistics are temporarily unavailable. The verified league record and Elo history remain above.</p>';
});
})();
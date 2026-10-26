(()=>{'use strict';const root=document.getElementById('nbl-matchups');if(!root)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const logo=t=>'<img class="nbl-depth-logo" alt="" loading="lazy" src="assets/nbl-logos/'+t.toLowerCase().replace(/[^a-z0-9]/g,'')+'.png">';
const get=async p=>{let r=await fetch(p,{cache:'no-store'});if(!r.ok)throw Error('Missing game file');return r.json()};
Promise.all([get('data/nbl-research-current-ledger.json'),get('data/nbl-standings.json'),get('data/nbl-elo-research.json'),get('data/nbl-research-baseline.json')]).then(([l,s,e,h])=>{
 if(!Array.isArray(l.games)||s.rows?.length!==10||e.ratings?.length!==10)throw Error('Unmatched archive');
 const names=s.rows.map(r=>r.team).sort(),lookup=new Map(s.rows.map(r=>[r.team,r])),elo=new Map(e.ratings.map(r=>[r.team,r]));
 const opts=names.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
 root.innerHTML='<div class="nbl-matchup-controls"><label>Club one<select id="nbl-first">'+opts+'</select></label><label>Club two<select id="nbl-second">'+opts+'</select></label></div><div id="nbl-matchup-output"></div>';
 const first=document.getElementById('nbl-first'),second=document.getElementById('nbl-second');first.value='Sydney Kings';second.value='Melbourne United';
 function render(){const a=first.value,b=second.value,out=document.getElementById('nbl-matchup-output');if(a===b){out.textContent='Choose two different teams.';return}
 const meetings=l.games.filter(g=>(g.home===a&&g.away===b)||(g.home===b&&g.away===a)).sort((x,y)=>String(y.played_at).localeCompare(String(x.played_at)));
 const winA=meetings.filter(g=>(g.home===a?g.home_score>g.away_score:g.away_score>g.home_score)).length;
 const winB=meetings.length-winA;
 const metrics=t=>{let r=lookup.get(t),v=elo.get(t);return {record:r.wins+'–'+r.losses,ppg:(r.points_for/r.played).toFixed(1),opp:(r.points_against/r.played).toFixed(1),margin:((r.points_for-r.points_against)/r.played).toFixed(1),elo:Number(v.elo).toFixed(1)}};
 const x=metrics(a),y=metrics(b);
 const metric=(label,key)=>'<div class="nbl-matchup-metric"><strong>'+esc(x[key])+'</strong><span>'+label+'</span><strong>'+esc(y[key])+'</strong></div>';
 out.innerHTML='<div class="nbl-matchup-header"><div>'+logo(a)+'<h2>'+esc(a)+'</h2></div><span>VERSUS</span><div>'+logo(b)+'<h2>'+esc(b)+'</h2></div></div><div class="nbl-matchup-metrics">'+metric('SEASON RECORD','record')+metric('ELO RATING','elo')+metric('POINTS / GAME','ppg')+metric('OPPONENT PPG','opp')+metric('SCORING MARGIN','margin')+'</div><section class="nbl-depth-panel"><div class="nbl-depth-eyebrow">2026–27 HEAD TO HEAD</div><h2>'+winA+'–'+winB+' in '+meetings.length+' completed meetings</h2>'+(meetings.length?meetings.map(g=>'<div class="nbl-matchup-meeting"><time>'+esc(new Date(g.played_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}))+'</time><strong>'+esc(g.away)+' '+g.away_score+' — '+esc(g.home)+' '+g.home_score+'</strong>'+(g.source_url?'<a href="'+esc(g.source_url)+'" target="_blank" rel="noopener noreferrer">Box score ↗</a>':'')+'</div>').join(''):'<p>No completed regular-season meeting in the current-season ledger yet.</p>')+'</section><p class="nbl-depth-note">This head-to-head record covers the current 2026–27 regular season only. Historical meetings and player availability are not assumed. Elo ratings are descriptive, not certified win probabilities. <a href="nbl-methodology.html">Methodology</a>.</p>';
 }first.addEventListener('change',render);second.addEventListener('change',render);render();
}).catch(e=>root.textContent='Matchup desk temporarily unavailable: '+e.message);
})();
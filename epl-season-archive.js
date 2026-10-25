(()=>{'use strict';
const root=document.getElementById('epl-season-archive');if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
Promise.all([fetch('data/epl-ratings.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}),fetch('data/epl-match-reports.json',{cache:'no-store'}).then(r=>r.ok?r.json():{matches:{}})]).then(([r,d])=>{
const games=[...(r.season_results||[])].sort((a,b)=>Date.parse(b.kickoff_utc)-Date.parse(a.kickoff_utc));
const rows=games.map(g=>{const detailed=!!d.matches?.[String(g.fixture_id)];return '<a class="epl-archive-row" href="epl-match-report.html?game='+encodeURIComponent(g.fixture_id)+'"><time>'+esc(new Date(g.kickoff_utc).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'America/New_York'}))+'</time><span class="epl-archive-club">'+esc(g.home)+'</span><strong>'+esc(g.home_score)+'–'+esc(g.away_score)+'</strong><span class="epl-archive-club">'+esc(g.away)+'</span><small>'+(detailed?'Full report':'Verified final')+'</small></a>'}).join('');
root.innerHTML='<h2>FULL SEASON RESULTS ARCHIVE</h2><p>'+games.length+' verified finals · '+games.filter(g=>d.matches?.[String(g.fixture_id)]).length+' detailed reports · All final scores sourced from the Elo replay archive.</p><div class="epl-archive-list">'+rows+'</div>';
}).catch(()=>{root.textContent='The verified EPL archive is temporarily unavailable.'});
})();
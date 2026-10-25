(()=>{'use strict';
const root=document.getElementById('cs-match-view');if(!root)return;
const $=(t,s,c)=>{const n=document.createElement(t);if(s!==null&&s!==undefined)n.textContent=String(s);if(c)n.className=c;return n;};
const param=new URLSearchParams(location.search),id=param.get('game')||'';
const get=async path=>{const r=await fetch(path+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(path);return r.json();};
const profile=(c,team)=>'college-soccer-team.html?team='+encodeURIComponent(c+':'+team);
const date=v=>{if(!v)return 'Date unavailable';const d=new Date(v);return Number.isNaN(+d)?String(v):d.toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});};
const pct=v=>Math.round(Number(v)*100)+'%';
const link=(s,href)=>{const a=$('a',s);a.href=href;if(/^https?:/i.test(href)){a.target='_blank';a.rel='noopener noreferrer';}return a;};
const field=(s,v)=>{const n=$('div',null,'cs-match-fact');n.append($('span',s),$('strong',v));return n;};
const brandMark=(team,cohort,branding)=>{
 const badge=$('span',team?.team?.slice(0,2).toUpperCase()||'SC','cs-match-badge');
 const b=branding.teams?.[cohort+':'+team?.team_id];
 const src=b?.logo_url||(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(team?.team_id||'')?'https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/'+team.team_id+'.svg':null);
 if(src){const img=$('img');img.src=src;img.alt='';img.loading='lazy';img.addEventListener('load',()=>badge.classList.add('has-image'));img.addEventListener('error',()=>img.remove());badge.append(img);}
 if(b?.primary)badge.style.setProperty('--school',b.primary);
 return badge;
};
(async()=>{
 try{
 if(!/^(men|women)-\d{6,9}$/.test(id))throw Error('Invalid or missing game ID');
 const [ledger,forecasts,ratings,branding,gameIndex]=await Promise.all([
  get('data/college-soccer-elo-final-ledger.json'),get('data/college-soccer-prospective-v2.json'),
  get('data/college-soccer-elo.json'),get('data/college-soccer-team-branding.json'),
  get('data/college-soccer-team-game-index.json').catch(()=>({teams:{}}))
 ]);
 const final=ledger.results?.find(x=>x.match_id===id)||null;
 const pre=forecasts.forecasts?.find(x=>x.match_id===id)||null;
 if(!final&&!pre)throw Error('This game is not in the published match index');
 const cohort=pre?.cohort||[...Object.keys(ratings.cohorts||{})].find(c=>{
  if(!c.startsWith(id.split('-')[0]+'-'))return false;
  const programs=ratings.cohorts[c];
  return programs.some(t=>t.team_id===final?.home_team)&&programs.some(t=>t.team_id===final?.away_team);
 })||null;
 const teams=ratings.cohorts?.[cohort]||[];
 const school=(teamId,fallback)=>teams.find(x=>x.team_id===teamId)||{team_id:teamId,team:fallback||String(teamId||'').replaceAll('-',' '),elo:null};
 const home=school(pre?.home_team||final?.home_team,pre?.home_name);
 const away=school(pre?.away_team||final?.away_team,pre?.away_name);
 const finished=!!final,score=finished?final.home_goals+' – '+final.away_goals:'vs';
 root.replaceChildren();const eyebrow=$('div',(cohort||'NCAA SOCCER').toUpperCase().replace('-',' · DIVISION ')+' · '+(finished?'VERIFIED FINAL':'PREGAME MODEL RECORD'),'cs-match-eyebrow');root.append(eyebrow);
 const head=$('header',null,'cs-match-hero');
 const schoolCol=(t,side)=>{const col=$('div',null,'cs-match-school');col.append(brandMark(t,cohort,branding));col.append(link(t.team,profile(cohort,t.team_id)));const meta=$('span',null,'cs-match-school-meta');if(t.record)meta.textContent=t.record+' · '+Number(t.elo).toFixed(1)+' Elo';else meta.textContent='NCAA Soccer';col.append(meta);return col;};
 head.append(schoolCol(home,'home'));const center=$('div',null,'cs-match-score');center.append($('strong',score));center.append($('span',finished?'FINAL · '+date(final.date):date(pre.kickoff_utc)));head.append(center,schoolCol(away,'away'));root.append(head);
 const links=$('div',null,'cs-match-links');links.append(link('← All NCAA scores','college-soccer.html'));
 const official=final?.source_game||pre?.source_game;if(official)links.append(link('Official NCAA match record ↗',official));root.append(links);
 const grid=$('div',null,'cs-match-grid');root.append(grid);
 const lead=$('section',null,'cs-match-panel');grid.append(lead);
 lead.append($('h2',finished?'The final score':'The forecast'));
 const headline=$('p',finished?home.team+' '+final.home_goals+', '+away.team+' '+final.away_goals:home.team+' vs '+away.team,'cs-match-headline');lead.append(headline);
 if(finished){
  const note=$('p','Final result verified against the NCAA game record and included in the independent result ledger. No simulated player statistics or events are displayed.','cs-match-note');lead.append(note);
  if(Number.isFinite(Number(ratings.latest_finals?.find(m=>m.match_id===id)?.home_elo_change))){
   const change=Number(ratings.latest_finals.find(m=>m.match_id===id).home_elo_change);
   lead.append(field('Verified home-team Elo movement',(change>=0?'+':'')+change.toFixed(1)));
  }
 }else lead.append($('p','A locked pregame projection is available. A scheduled kickoff does not establish that a match is currently live or final.','cs-match-note'));
 const comparison=$('section',null,'cs-match-panel');grid.append(comparison);comparison.append($('h2','The matchup · current model ratings'));
 if(home.elo!==null&&home.elo!==undefined&&away.elo!==null&&away.elo!==undefined&&Number.isFinite(Number(home.elo))&&Number.isFinite(Number(away.elo))){
  for(const team of [home,away]){
   const d=$('div',null,'cs-match-elo-row');d.append(link(team.team,profile(cohort,team.team_id)), $('strong',Number(team.elo).toFixed(1)));
   comparison.append(d);
  }
  comparison.append($('p','Ratings reflect the published current edition, not necessarily the ratings available before kickoff.','cs-match-note'));
  if(Number(home.gp)>0&&Number(away.gp)>0){
   const compare=$('div',null,'cs-match-stat-comparison');
   const duel=(label,a,b,lowerBetter)=>{
    const row=$('div',null,'cs-match-stat-row');row.append($('small',label));
    const values=$('div',null,'cs-match-stat-values');
    const left=$('strong',Number(a).toFixed(2)),right=$('strong',Number(b).toFixed(2));
    const better=lowerBetter?a<b:a>b;
    const reverse=lowerBetter?b<a:b>a;
    if(better)left.className='cs-match-stat-advantage';
    if(reverse)right.className='cs-match-stat-advantage';
    values.append(left,$('span','—'),right);row.append(values);
    const tracks=$('div',null,'cs-match-stat-tracks');
    const high=Math.max(a,b,.01);
    for(const [v,kind] of [[a,'home'],[b,'away']]){
     const track=$('span',null,'cs-match-stat-track');const bar=$('i',null,'cs-match-stat-'+kind);
     bar.style.width=100*v/high+'%';track.append(bar);tracks.append(track);
    }row.append(tracks);compare.append(row);
   };
   duel('Goals scored per match',home.gf/home.gp,away.gf/away.gp,false);
   duel('Goals allowed per match',home.ga/home.gp,away.ga/away.gp,true);
   comparison.append(compare);
   comparison.append($('p','Season rates are calculated directly from verified published goals and games played. They are not match-specific statistics.','cs-match-note'));
  }
 }else comparison.append($('p','Comparable published Elo ratings could not be resolved for both programs.','cs-match-note'));
 if(pre){
  const pred=$('section',null,'cs-match-panel cs-pregame');root.append(pred);
  pred.append($('h2','The pregame probability file'));
  const bar=$('div',null,'cs-match-prob');for(const [key,cl] of [['p_home','home'],['p_draw','draw'],['p_away','away']]){const n=$('i',null,'cs-match-prob-'+cl);n.style.width=100*Math.max(0,Number(pre[key]))+'%';bar.append(n);}pred.append(bar);
  const probs=$('div',null,'cs-match-prob-labels');probs.append(field(home.team,pct(pre.p_home)),field('Draw',pct(pre.p_draw)),field(away.team,pct(pre.p_away)));pred.append(probs);
  const estimates=$('div',null,'cs-match-estimates');
  estimates.append(field(home.team+' expected goals',Number(pre.expected_home_goals).toFixed(2)),field(away.team+' expected goals',Number(pre.expected_away_goals).toFixed(2)));
  pred.append(estimates);
  pred.append($('p','Forecast locked '+date(pre.forecasted_at_utc)+'; training cutoff '+String(pre.training_cutoff||'not published')+'. Model projections are not actual match statistics.','cs-match-note'));
 }
 const form=$('section',null,'cs-match-panel cs-recent-form');form.append($('h2','Recent verified results'));
 let formCount=0;
 for(const side of [home,away]){
  const all=gameIndex.teams?.[cohort+':'+side.team_id]?.games||[];
  const finals=all.filter(g=>g.status==='final'&&Number.isInteger(g.goals_for)&&Number.isInteger(g.goals_against)&&g.source_url).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,5);
  if(!finals.length)continue;
  formCount++;
  const group=$('div',null,'cs-form-group');group.append(link(side.team,profile(cohort,side.team_id)));
  const results=$('div',null,'cs-form-results');
  for(const game of finals){
   const outcome=game.goals_for>game.goals_against?'W':game.goals_for<game.goals_against?'L':'D';
   const a=link(outcome,game.source_url);a.className='cs-form-pill cs-form-'+outcome.toLowerCase();
   a.title=date(game.date)+' · '+side.team+' '+game.goals_for+'-'+game.goals_against+' vs '+game.opponent;
   a.setAttribute('aria-label',a.title);results.append(a);
  }
  group.append(results);group.append($('small',finals.length+' verified final'+(finals.length!==1?'s':'')+' indexed · newest first'));
  form.append(group);
 }
 if(formCount){form.append($('p','Partial verified-final coverage only. These strips are not presented as full season form when historical games are missing.','cs-match-note'));root.append(form);}
 const foot=$('p','Data sources: NCAA verified final ledger, frozen pregame forecasts, and independent USRS ratings. Games without verified play-by-play or box scores do not display invented events, shots, cards, or lineups.','cs-match-footer');root.append(foot);
 }catch(err){root.replaceChildren($('h1','NCAA match unavailable'),$('p','There is no confirmed match record for this link.'));root.append(link('Return to NCAA Soccer','college-soccer.html'));console.error('NCAA match detail',err);}
})();
})();
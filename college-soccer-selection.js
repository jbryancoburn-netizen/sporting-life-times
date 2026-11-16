(()=>{'use strict';
const host=document.getElementById('ncaa-selection-forecast');if(!host)return;
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x};
const file=async path=>{const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(path+' unavailable');return r.json()};
let mode='ncaa';
const certifiedAQ=x=>x?.official_aq===true&&x?.championship_result?.winner_id===x.team_id&&x?.championship_result?.home_team_id&&x?.championship_result?.away_team_id&&/^https:\/\//.test(x.source_url||'');
// The shared NCAA soccer crest renderer is the sole owner of both school-color rings.
const brandFor=(entry,branding)=>branding?.teams?.['men-d1:'+entry?.team_id]||{};
function schoolRow(entry,branding,kind=''){
 const line=el('div',null,'ncaa-school-row '+kind);
 if(!entry){line.append(el('span','TO BE SELECTED','ncaa-school-placeholder'));return line}
 const name=entry.team||entry.team_id;
 const crest=window.CollegeSoccerCupUI.crest(name,entry.team_id,'men-d1',branding);
 const meta=el('span',null,'ncaa-school-meta');meta.append(el('strong',name),el('small',(entry.conference||'').replace('men-d1:','').toUpperCase()+' · '+(entry.bid_type==='official_aq'?'VERIFIED CONFERENCE CHAMPION':entry.bid_type==='projected_aq'?'PREDICTED AQ':'AT-LARGE')));
 const schoolColor=branding?.soccer_palette?.['men-d1:'+entry.team_id]?.primary||brandFor(entry,branding).primary;
 if(/^#[0-9a-f]{6}$/i.test(schoolColor||''))line.style.setProperty('--school-accent',schoolColor);
 line.append(crest,meta);return line;
}
function draw(data,metrics,branding){
 host.replaceChildren();
 const nav=el('div',null,'cs-selection-modes');
 for(const [value,label] of [['ncaa','NCAA RPI-LED PREDICTION'],['usrs','RETRO INDEPENDENT PREDICTION']]){
  const b=el('button',label);b.type='button';b.className=mode===value?'active':'';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>{mode=value;draw(data,metrics,branding)};nav.append(b)
 }host.append(nav);
 const verifiedAqs=(data.automatic_bid_scenarios||[]).filter(certifiedAQ);
 // Source-dated independent RPI prediction; not official committee seeds.
 const ncaaInputsReady=metrics?.status==='final_preselection_rpi_led_ncaa_criteria_projection_not_official'
   &&metrics?.independent_of_retro===true
   &&Array.isArray(metrics?.field)&&metrics.field.length===48
   &&metrics.field.filter(x=>x.bid_type==='official_aq').length===23
   &&metrics.field.filter(x=>x.bid_type==='rpi_at_large_projection').length===25
   &&metrics.field.every(x=>Number.isInteger(x.rpi_rank)&&x.ncaa_seed===null);
 // A published forecast must not silently treat an old rating cutoff as current.
 const cutoffDate=Date.parse(String(data.rating_cutoff||'')+'T23:59:59Z');
 const ageDays=Number.isFinite(cutoffDate)?Math.max(0,Math.floor((Date.now()-cutoffDate)/86400000)):Infinity;
 if(mode==='usrs'&&ageDays>1)host.append(el('p','STALE FORECAST: RETRO ratings are '+ageDays+' days old. This is an archived projection, not a current tournament forecast.','cs-selection-warning'));
 if(mode==='usrs'&&data.elo_reconciliation?.excluded_finals>0)host.append(el('p','DATA INTEGRITY WARNING: '+data.elo_reconciliation.excluded_finals+' final matches excluded from the RETRO ratings input. Tournament probabilities are provisional.','cs-selection-warning'));
 const claimedAqs=(data.field||[]).filter(x=>x.bid_type==='official_aq');
 const confirmedIds=new Set(verifiedAqs.map(x=>x.team_id));
 if(claimedAqs.some(x=>!confirmedIds.has(x.team_id)))host.append(el('p','AUTOMATIC BID CONFLICT: The projected field marks teams as confirmed without matching certified championship records. Review required.','cs-selection-warning'));
 if(mode==='usrs'&&data.elo_reconciliation?.source_certified!==true){
   host.append(el('p','SOURCE AUDIT: Provisional ratings. NCAA-compliant selection inputs remain unverified; the bracket is illustrative and must not be presented as the official tournament field.','cs-selection-warning'));
 }
 const forecastStamp=el('p','RETRO rating cutoff: '+(data.rating_cutoff||'unverified')+' · '+verifiedAqs.length+' of '+(data.automatic_bids||23)+' automatic qualifiers officially confirmed in this feed · Remaining AQ places are predictions.','cs-selection-warning');
 if(mode==='usrs')host.append(forecastStamp);
 const official=(data.automatic_bid_scenarios||[]).filter(certifiedAQ);
 const scenarios=(data.automatic_bid_scenarios||[]).filter(x=>!certifiedAQ(x));
 const pendingReview=scenarios.filter(x=>x.official_aq===true);
 if(pendingReview.length)host.append(el('p','CHAMPIONSHIP PROVENANCE: '+pendingReview.length+' previously confirmed automatic bids lack explicit winner/fixture verification. They are now marked PENDING REVIEW, not confirmed.','cs-selection-warning'));
 const status=el('section',null,'cs-selection-source-status cs-aq-ledger');
 status.append(el('h2','CONFERENCE TOURNAMENT TRACKER · 23 AUTOMATIC BIDS'));
 status.append(el('p',official.length+' source-certified champions · '+pendingReview.length+' championship records pending provenance review · '+(scenarios.length-pendingReview.length)+' projected picks. Ratings through '+(data.rating_cutoff||'unknown')+'.','cs-selection-warning'));
 status.append(el('p','OFFICIAL CHAMPION = verified conference tournament winner · RETRO PICK = forecast only. The regular-season champion is not automatically the tournament champion.','cs-aq-legend'));
 const gallery=el('div',null,'cs-aq-grid');
 for(const x of [...official,...scenarios].sort((a,b)=>(a.official_aq===b.official_aq?String(a.conference_name).localeCompare(String(b.conference_name)):a.official_aq?-1:1))){
   const card=el('article',null,'cs-aq-card '+(certifiedAQ(x)?'cs-aq-confirmed':'cs-aq-projected'));
   const slug=String(x.conference||'').replace(/^men-d1:/,'');
   const title=el('h3'),conferenceLink=el('a',x.conference_name||slug);
   conferenceLink.href='college-soccer-'+slug+'-men.html';title.append(conferenceLink);card.append(title);
   card.append(el('span',certifiedAQ(x)?'★ VERIFIED TOURNAMENT CHAMPION':x.official_aq?'◇ CHAMPIONSHIP RESULT · WINNER UNVERIFIED':'◇ RETRO PICK · TITLE UNCONFIRMED','cs-aq-status'));
   card.append(el('strong',x.team||x.team_id,'cs-aq-team'));
   if(x.official_aq&&x.source_url){const proof=el('a',certifiedAQ(x)?'Verified championship source':'Championship source · review pending');proof.href=x.source_url;proof.target='_blank';proof.rel='noopener noreferrer';card.append(proof);}
   gallery.append(card);
 }
 status.append(gallery);
 let comparisonBlock=null;
 if(ncaaInputsReady){
  const nIds=new Set(metrics.field.map(x=>x.team_id)),uIds=new Set(data.field.map(x=>x.team_id));
  const ncaaOnly=metrics.field.filter(x=>!uIds.has(x.team_id));
  const usrsOnly=data.field.filter(x=>!nIds.has(x.team_id));
  const comparison=el('section',null,'ncaa-selection-comparison');
  comparison.append(el('h2','THE SELECTION SPLIT'));
  const stats=el('div',null,'ncaa-selection-compare-grid');
  const same=el('div',null,'ncaa-selection-compare-metric');same.append(el('strong',48-ncaaOnly.length),el('span','AGREED TEAMS'));
  const different=el('div',null,'ncaa-selection-compare-metric');different.append(el('strong',ncaaOnly.length),el('span','EACH MODEL PICKS DIFFERENTLY'));
  stats.append(same,different);comparison.append(stats);
  const lists=el('div',null,'ncaa-selection-compare-lists');
  for(const [label,rows] of [['NCAA RPI MODEL ONLY',ncaaOnly],['RETRO MODEL ONLY',usrsOnly]]){
   const col=el('section');col.append(el('h3',label));
   for(const x of rows)col.append(schoolRow(x,branding,'ncaa-compare-team'));
   lists.append(col);
  }
  comparison.append(lists);comparisonBlock=comparison;
 }
 const summary=el('div',null,'cs-selection-summary');
 for(const [value,label] of [[48,'FIELD'],[23,'AUTOMATIC'],[25,'AT-LARGE'],[24,'SEEDED IN 2026'],[16,'FIRST-ROUND BYES']]){const x=el('div',null,'cs-selection-metric');x.append(el('strong',value),el('span',label));summary.append(x)}host.append(summary);
 if(mode==='ncaa'){
   const rules=el('section',null,'snb-ncaa-rules');
   rules.append(el('h2','NCAA SELECTION PROCEDURE · 2026'));
   rules.append(el('p','The NCAA committee, not RETRO, selects 25 at-large teams. Eligible at-large candidates must have a Division I won-lost-tied record of at least .500. Its evaluation also considers adjusted RPI, schedule strength, results against common opponents, head-to-head competition, nonconference performance, results against selected teams, last-eight-match performance and conference competition. Coaches polls and outside ranking systems are not selection criteria.','cs-selection-warning'));
   rules.append(el('p','The 2026 championship has 23 automatic bids, 25 at-large bids, 24 seeded teams and 16 first-round byes. The October 22 NCAA update expanded seeding from 16 to 24; the older prechampionship manual still mentions 16 seeds. Conference opponents should not meet in their first tournament game, and site/travel placement requires NCAA authorization.','cs-selection-warning'));
   const manual=el('a','2026-27 NCAA prechampionship manual');manual.href='https://ncaaorg.s3.amazonaws.com/championships/sports/soccer/d1/men/2026-27D1MSO_PreChampsManual.pdf';manual.target='_blank';manual.rel='noopener noreferrer';
   const amendment=el('a','October 22 NCAA 24-seed announcement');amendment.href='https://www.ncaa.org/news/di-field-hockey-mens-soccer-to-seed-50-of-their-championship-brackets/';amendment.target='_blank';amendment.rel='noopener noreferrer';
   const citations=el('p',null,'snb-ncaa-sources');citations.append(manual,el('span',' · '),amendment);rules.append(citations);
   if(ncaaInputsReady){
     rules.append(el('p','Final pre-selection forecast: 23 source-certified conference winners and 25 RPI-led at-large candidates screened against the NCAA Division I .500 threshold. The model uses November 14 NCAA RPI ranks and projected seeds 1–24, NOT RETRO. Other NCAA committee résumé criteria (head-to-head, common opponents, last eight games, roster availability) are not completely verified; no NCAA hosts or actual committee pairings are asserted.','cs-selection-warning'));
     const mirror=el('a','Nov. 14 NCAA RPI ranking mirror');mirror.href=metrics.ranking_source;mirror.target='_blank';mirror.rel='noopener noreferrer';
     const officialRpi=el('a','Official NCAA RPI ranking');officialRpi.href=metrics.official_rpi_reference;officialRpi.target='_blank';officialRpi.rel='noopener noreferrer';
     const p=el('p',null,'snb-ncaa-sources');p.append(mirror,el('span',' · '),officialRpi);rules.append(p);
   }else{
     rules.append(el('h3','NCAA RPI FORECAST UNAVAILABLE'));
     rules.append(el('p','Cannot verify the separate RPI-led projection. No committee prediction will be invented.','cs-selection-warning'));
   }
   host.append(rules);
 }
 const entries=mode==='usrs'?data.field:(ncaaInputsReady?metrics.field:[]);
 if(mode==='usrs'){
   host.append(el('h2','INDEPENDENT RETRO BRACKET · NOT NCAA SELECTION'));
   host.append(el('p','This is a 48-team RETRO-only demonstration of the NCAA tournament format, not an NCAA selection forecast. Its 25 at-large candidates are ranked by RETRO without verified full-season Division I eligibility; the positions are not committee seeds. Travel, venues and official matchups are withheld.','cs-selection-warning'));
 }
 const bracketMount=el('div',null,'snb-national-mount');
 host.append(bracketMount);
 const national=window.SoccerNationalBracket;
 if(!national){
   bracketMount.append(el('p','The national bracket renderer is unavailable. Matchups are withheld rather than fabricated.','cs-selection-warning'));
 }else if(mode==='ncaa'&&!ncaaInputsReady){
   bracketMount.append(el('p','NCAA projection withheld: 48 certified RPI-led entries are missing.','cs-selection-warning'));
 }else{
   national.render(bracketMount,entries,branding,mode==='usrs'?window.SoccerRetroKnockout?.match:null,{
     cutoff:mode==='ncaa'?metrics.rpi_as_of:data.rating_cutoff,confirmed:verifiedAqs.length,mode
   });
 }
 if(comparisonBlock){
   try{
     const n=window.SoccerNationalBracket.makeBracket(metrics.field,null,{mode:'ncaa'});
     const r=window.SoccerNationalBracket.makeBracket(data.field,window.SoccerRetroKnockout.match,{mode:'usrs'});
     comparisonBlock.prepend(el('p','NCAA RPI title pick: '+(n.championship.winner?.team||'pending')+' · RETRO title pick: '+(r.championship.winner?.team||'pending')+'.','cs-selection-warning'));
     const nByes=new Set(metrics.field.slice(0,16).map(x=>x.team_id));
     const rByes=new Set(data.field.slice(0,16).map(x=>x.team_id));
     comparisonBlock.prepend(el('p',[...nByes].filter(x=>rByes.has(x)).length+' of 16 projected bye teams agree.','cs-selection-warning'));
   }catch(err){comparisonBlock.prepend(el('p','Comparison unavailable: '+err.message,'cs-selection-warning'))}
   host.append(comparisonBlock);
 }
 host.append(status);
 const groups=mode==='usrs'?[['RETRO TOP 24 · NOT NCAA SEEDS',entries.slice(0,24)],['RETRO HYPOTHETICAL REMAINING FIELD',entries.slice(24)],['RETRO NEXT FOUR · ELIGIBILITY UNVERIFIED',data.first_four_out_proxy||[]]]:ncaaInputsReady?[['NCAA RPI-LED PROJECTED SEEDS 1–24',entries.slice(0,24)],['NCAA RPI-LED UNSEEDED ENTRANTS',entries.slice(24)],['NCAA RPI-LED FIRST FOUR OUT',metrics.first_four_out||[]]]:[];
 for(const [name,rows] of groups){
  const section=el('section',null,'cs-selection-group');section.append(el('h2',name));
  const table=el('table',null,'cs-selection-table');const head=el('tr');
  for(const h of ['#','School','Bid path',mode==='usrs'?'RETRO':'NCAA RPI'])head.append(el('th',h));table.append(head);
  rows.forEach((x,i)=>{const tr=el('tr');for(const v of [mode==='usrs'?(x.experimental_strength_order||i+1):(x.projected_seed||x.projection_order||'—'),x.team,x.bid_type==='official_aq'?'Verified AQ':x.bid_type==='projected_aq'?'RETRO predicted AQ':mode==='usrs'?'RETRO at-large':'RPI-led at-large forecast',mode==='usrs'?Math.round(x.elo):'#'+x.rpi_rank])tr.append(el('td',v));table.append(tr)});
  section.append(table);host.append(section);
 }
}
async function show(){try{const data=await file('data/college-soccer-ncaa-selection-forecast.json');if(data.field?.length!==48)throw Error('Invalid field');const metrics=await file('data/college-soccer-ncaa-selection-projection-2026.json').catch(()=>({status:'not_ready'}));const branding=await file('data/college-soccer-team-branding.json').catch(()=>({teams:{}}));
 const [palette,overrides,local]=await Promise.all([
   file('data/dual-ring-team-palette.json').catch(()=>({soccer:{}})),
   file('data/college-soccer-crest-overrides.json').catch(()=>({schools:{}})),
   file('data/college-soccer-local-crest-manifest.json').catch(()=>({teams:{}}))
 ]);
 branding.soccer_palette=palette.soccer||{};
 branding.crest_overrides=overrides.schools||{};
 branding.local_crests=local.teams||{};
 const unmapped=[...data.field,...(metrics.field||[])].filter(x=>!branding.local_crests['men-d1:'+x.team_id]);
 draw(data,metrics,branding);
 if(unmapped.length){
   host.prepend(el('p','LOGO AUDIT: Local archive artwork is pending for '+unmapped.map(x=>x.team).join(', ')+'. A labeled initials fallback is shown until a verified logo is available.','cs-selection-warning'));
 }
 const audit=document.getElementById('cs-selection-audit');
 if(audit){
   const state=await file('data/college-soccer-selection-update-status.json').catch(()=>null);
   audit.replaceChildren(el('strong','NCAA SOCCER · FORECAST PUBLICATION AUDIT'));
   audit.append(el('p','RETRO games through '+(data.rating_cutoff||'unverified')+' · 48 projected programs · '+(data.automatic_bid_scenarios||[]).filter(certifiedAQ).length+' provenance-certified automatic bids in published data.'));
   if(state){
     audit.append(el('p','Daily publisher: '+(state.status||'unknown')+' · Checked '+(state.checked_at_utc||'unverified')));
     if(state.status!=='retro_projection_updated'&&state.status!=='published')audit.append(el('p','Publishing issue: '+String(state.reason||'unknown').slice(0,240)));
   }else audit.append(el('p','No verified daily workflow execution report is available yet.'));
   audit.append(el('p','Separate models: NCAA résumé forecast uses November 14 RPI and source-certified champions through November 15; RETRO uses independent ratings. Neither is the announced NCAA committee field.'));
 }
 }catch(e){host.replaceChildren(el('p','Selection forecast unavailable: '+e.message))}}
show();setInterval(show,60000);
})();
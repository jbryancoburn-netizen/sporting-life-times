(()=>{'use strict';
const host=document.getElementById('ncaa-selection-forecast');if(!host)return;
const el=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined&&txt!==null)x.textContent=String(txt);if(cls)x.className=cls;return x};
const file=async path=>{const r=await fetch(path+'?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(path+' unavailable');return r.json()};
let mode='usrs';
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
 for(const [value,label] of [['ncaa','NCAA RÉSUMÉ PROXY'],['usrs','RETRO 48-TEAM PREDICTION']]){
  const b=el('button',label);b.type='button';b.className=mode===value?'active':'';b.setAttribute('aria-pressed',String(mode===value));b.onclick=()=>{mode=value;draw(data,metrics,branding)};nav.append(b)
 }host.append(nav);
 const verifiedAqs=(data.automatic_bid_scenarios||[]).filter(certifiedAQ);
 // A published forecast must not silently treat an old rating cutoff as current.
 const cutoffDate=Date.parse(String(data.rating_cutoff||'')+'T23:59:59Z');
 const ageDays=Number.isFinite(cutoffDate)?Math.max(0,Math.floor((Date.now()-cutoffDate)/86400000)):Infinity;
 if(ageDays>1)host.append(el('p','STALE FORECAST: RETRO ratings are '+ageDays+' days old. This is an archived projection, not a current tournament forecast.','cs-selection-warning'));
 if(data.elo_reconciliation?.excluded_finals>0)host.append(el('p','DATA INTEGRITY WARNING: '+data.elo_reconciliation.excluded_finals+' final matches excluded from the RETRO ratings input. Tournament probabilities are provisional.','cs-selection-warning'));
 const claimedAqs=(data.field||[]).filter(x=>x.bid_type==='official_aq');
 const confirmedIds=new Set(verifiedAqs.map(x=>x.team_id));
 if(claimedAqs.some(x=>!confirmedIds.has(x.team_id)))host.append(el('p','AUTOMATIC BID CONFLICT: The projected field marks teams as confirmed without matching certified championship records. Review required.','cs-selection-warning'));
 if(data.elo_reconciliation?.source_certified!==true){
   host.append(el('p','SOURCE AUDIT: Provisional ratings. NCAA-compliant selection inputs remain unverified; the bracket is illustrative and must not be presented as the official tournament field.','cs-selection-warning'));
 }
 const forecastStamp=el('p','RETRO rating cutoff: '+(data.rating_cutoff||'unverified')+' · '+verifiedAqs.length+' of '+(data.automatic_bids||23)+' automatic qualifiers officially confirmed in this feed · Remaining AQ places are predictions.','cs-selection-warning');
 host.append(forecastStamp);
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
 if(Array.isArray(metrics?.field)&&metrics.field.length===48){
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
  for(const [label,rows] of [['NCAA RPI ONLY',ncaaOnly],['RETRO ONLY',usrsOnly]]){
   const col=el('section');col.append(el('h3',label));
   for(const x of rows)col.append(schoolRow(x,branding,'ncaa-compare-team'));
   lists.append(col);
  }
  comparison.append(lists);host.append(comparison);
 }
 const summary=el('div',null,'cs-selection-summary');
 for(const [value,label] of [[48,'FIELD'],[23,'AUTOMATIC'],[25,'AT-LARGE'],[24,'SEEDED'],[16,'BYE TEAMS']]){const x=el('div',null,'cs-selection-metric');x.append(el('strong',value),el('span',label));summary.append(x)}host.append(summary);
 if(mode==='ncaa'){
  host.append(el('h2','NCAA RÉSUMÉ PROXY · NOT OFFICIAL'));
  host.append(el('p','The NCAA view is built around adjusted RPI, strength of schedule, record, nonconference results, head-to-head, common opponents, selected-opponent results and the final eight matches. It does NOT use RETRO Elo.','cs-selection-warning'));
  if(!Array.isArray(metrics?.field)||metrics.field.length!==48){
   host.append(el('h3','NCAA RPI FORECAST SOURCE NOT AVAILABLE'));
   host.append(el('p','The full NCAA résumé data is not available. A provisional NCAA RPI forecast is displayed when the ranking snapshot loads.','cs-selection-warning'));
  }
 }
 const entries=mode==='usrs'?data.field:(Array.isArray(metrics?.field)?metrics.field:[]);
 host.append(el('h2',mode==='usrs'?'RETRO SELECTION COMMITTEE · 48-TEAM PROJECTION':'PROVISIONAL RPI SNAPSHOT · 48-TEAM SCENARIO'));
 host.append(el('p',mode==='usrs'?'Your independent RETRO ratings are used only for a hypothetical 48-team field, protected positions and match predictions. Conference champions are sourced; at-large eligibility, committee evaluation, hosting and travel criteria are not yet fully verified.':'Projected NCAA committee field from the October 23 RPI table, conference qualification projections and provisional at-large eligibility. It is a forecast, not the official selection committee field.','cs-selection-warning'));
 const bracketMount=el('div',null,'snb-national-mount');
 host.append(bracketMount);
 const national=window.SoccerNationalBracket;
 if(!national){
   bracketMount.append(el('p','The national bracket renderer is unavailable. Matchups are withheld rather than fabricated.','cs-selection-warning'));
 }else if(entries.length!==48){
   bracketMount.append(el('p','NCAA résumé bracket withheld: the complete 48-team résumé input has not been verified. RETRO remains available in the other tab.','cs-selection-warning'));
 }else{
   national.render(bracketMount,entries,branding,mode==='usrs'?window.SoccerRetroKnockout?.match:null,{
     cutoff:data.rating_cutoff,confirmed:verifiedAqs.length,mode
   });
   if(mode!=='usrs')bracketMount.append(el('p','RPI résumé positions are provisional. No RETRO game winners are imposed on this alternate field.','cs-selection-warning'));
 }
 // The full conference champion register is below the bracket, not before it.
 host.append(status);
 const groups=[['FIRST 24 · PROJECTED ORDER',entries.slice(0,24)],['REMAINING FIELD',entries.slice(24)],['BUBBLE / NEXT FOUR',mode==='usrs'?data.first_four_out_proxy:metrics.first_four_out||[]]];
 for(const [name,rows] of groups){
  const section=el('section',null,'cs-selection-group');section.append(el('h2',name));
  const table=el('table',null,'cs-selection-table');const head=el('tr');
  for(const h of ['#','School','Bid path',mode==='usrs'?'RETRO':'Résumé score'])head.append(el('th',h));table.append(head);
  rows.forEach((x,i)=>{const tr=el('tr');for(const v of [x.experimental_strength_order||i+1,x.team,x.bid_type==='official_aq'?'Confirmed AQ':x.bid_type==='projected_aq'?'Predicted AQ':'At-large scenario',mode==='usrs'?Math.round(x.elo):x.resume_score??'—'])tr.append(el('td',v));table.append(tr)});
  section.append(table);host.append(section);
 }
}
async function show(){try{const data=await file('data/college-soccer-ncaa-selection-forecast.json');if(data.field?.length!==48)throw Error('Invalid field');const metrics=await file('data/college-soccer-ncaa-rpi-forecast-2026.json').catch(()=>({status:'not_ready'}));const branding=await file('data/college-soccer-team-branding.json').catch(()=>({teams:{}}));
 const [palette,overrides]=await Promise.all([file('data/dual-ring-team-palette.json').catch(()=>({soccer:{}})),file('data/college-soccer-crest-overrides.json').catch(()=>({schools:{}}))]);
 branding.soccer_palette=palette.soccer||{};branding.crest_overrides=overrides.schools||{};
 draw(data,metrics,branding);
 const audit=document.getElementById('cs-selection-audit');
 if(audit){
   const state=await file('data/college-soccer-selection-update-status.json').catch(()=>null);
   audit.replaceChildren(el('strong','NCAA SOCCER · FORECAST PUBLICATION AUDIT'));
   audit.append(el('p','RETRO games through '+(data.rating_cutoff||'unverified')+' · 48 projected programs · '+(data.automatic_bid_scenarios||[]).filter(certifiedAQ).length+' provenance-certified automatic bids in published data.'));
   if(state){
     audit.append(el('p','Daily publisher: '+(state.status||'unknown')+' · Checked '+(state.checked_at_utc||'unverified')));
     if(state.status!=='retro_projection_updated'&&state.status!=='published')audit.append(el('p','Publishing issue: '+String(state.reason||'unknown').slice(0,240)));
   }else audit.append(el('p','No verified daily workflow execution report is available yet.'));
   audit.append(el('p','Independent RETRO forecasts update separately from NCAA committee selection. Verified DI records and adjusted RPI are required for an NCAA-résumé-based forecast.'));
 }
 }catch(e){host.replaceChildren(el('p','Selection forecast unavailable: '+e.message))}}
show();setInterval(show,60000);
})();
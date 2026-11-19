/* Shared rendering for league-owned schedules and RETRO registers. */
(function(root){
 'use strict';
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const formatter=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'America/New_York'});
 const dateLabel=value=>{
  const text=String(value||'');
  const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(text)?text+'T12:00:00Z':text);
  return Number.isFinite(+date)?formatter.format(date):'Date TBD';
 };
 function schedule(games,empty){
  const columns=[['date','Date'],['matchup','Opponent'],['venue','Location'],['time','Time'],['network','Broadcast'],['elo','RETRO'],['result','Result']];
  const siteLabels={home:'Home',away:'Away',neutral:'Neutral',unknown:'Site unverified'};
  const rows=games.map((game,index)=>{
   const site=Object.hasOwn(siteLabels,game.site)?game.site:'unknown';
   const phase=['final','live','reported'].includes(game.phase)?game.phase:'upcoming';
   const color=/^#[0-9a-f]{6}$/i.test(game.color||'')?' style="--schedule-ink:'+game.color+'"':'';
   const outcome=game.outcome==='W'?' sched-win':game.outcome==='L'?' sched-loss':'';
   const name=escape(game.opponent);
   const opponent=game.teamHref?'<a href="'+escape(game.teamHref)+'">'+name+'</a>':name;
   const detailId='shared-schedule-detail-'+index;
   const action=game.gameHref?'<a class="victorian-stat-toggle" href="'+escape(game.gameHref)+'">Gamefile ↗</a>':
    game.detail?'<button type="button" class="victorian-stat-toggle" data-shared-schedule-toggle aria-expanded="false" aria-controls="'+detailId+'">Game details</button>':'';
   const values=['<time datetime="'+escape(game.date)+'">'+escape(dateLabel(game.date))+'</time>',
    '<div class="sched-matchup">'+(game.badge||'')+'<span class="sched-opponent"><strong>'+opponent+'</strong><span class="sched-site-stamp">'+siteLabels[site]+'</span></span></div>',
    ...[game.venue,game.tipoff,game.network,game.retro].map(value=>escape(value||'—')),
    '<strong class="sched-result-score'+outcome+'">'+escape(game.result||'Upcoming')+'</strong>'+action];
   return '<tr data-game-site="'+site+'" data-calendar-state="'+phase+'"'+color+'>'+
    columns.map(([key,label],i)=>'<td class="sched-'+key+'-cell" data-label="'+label+'">'+values[i]+'</td>').join('')+'</tr>'+
    (game.detail&&!game.gameHref?'<tr id="'+detailId+'" class="victorian-stat-detail" hidden><td colspan="7">'+game.detail+'</td></tr>':'');
  }).join('');
  return '<section class="panel victorian-team-calendar" id="full-season-schedule"><div class="panel-head"><h2>2026–2027 Schedule</h2></div>'+
   (rows?'<div class="table-wrap"><table class="mbb-schedule-table"><thead><tr>'+columns.map(([,label])=>'<th scope="col">'+label+'</th>').join('')+
   '</tr></thead><tbody>'+rows+'</tbody></table></div>':'<p class="note">'+escape(empty)+'</p>')+'</section>';
 }
 if(typeof document!=='undefined')document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-shared-schedule-toggle]');
  if(!button)return;
  const row=document.getElementById(button.getAttribute('aria-controls'));
  if(!row)return;
  row.hidden=!row.hidden;
  button.setAttribute('aria-expanded',String(!row.hidden));
 });
 const decoDigits=[
  'M3 1H9L11 3V21L9 23H3L1 21V3ZM5 1V23',
  'M3 5L7 1V23M3 23H11',
  'M1 4V3L3 1H9L11 3V9L1 19V23H11M1 19H11',
  'M1 1H9L11 3V9L8 12L11 15V21L9 23H1M4 12H8',
  'M8 23V1L1 15V17H11',
  'M11 1H1V11H9L11 13V21L9 23H1',
  'M10 1H4L1 5V21L3 23H9L11 21V13L9 11H1',
  'M1 1H11V5L4 23M1 5H11',
  'M3 1H9L11 3V9L8 12L11 15V21L9 23H3L1 21V15L4 12L1 9V3ZM4 12H8',
  'M11 13H3L1 11V3L3 1H9L11 3V19L8 23H2'
 ];
 const rankBadge=value=>{
  const number=String(value);
  if(!/^[0-9]{1,3}$/.test(number))return '<span class="rank-number"><span class="rank-number-value">'+escape(value)+'</span></span>';
  const width=number.length*16;
  const drawing=[...number].map((digit,index)=>'<path transform="translate('+(index*16+2)+' 1)" d="'+decoDigits[Number(digit)]+'"/>').join('');
  return '<span class="rank-number" data-place="'+number+'"><span class="rank-number-value">'+number+'</span><svg class="rank-number-art" viewBox="0 0 '+width+' 26" aria-hidden="true" focusable="false">'+drawing+'</svg></span>';
 };
 function rankingRow(row){
  const color=/^#[0-9a-f]{6}$/i.test(row.color||'')?' style="--rank-school-color:'+row.color+'"':'';
  const name=escape(row.name);
  return '<tr'+color+'><td>'+rankBadge(row.rank)+'</td><td><span class="rank-school">'+(row.badge||'')+
   (row.href?'<a href="'+escape(row.href)+'">'+name+'</a>':'<strong>'+name+'</strong>')+'</span>'+
   (row.note?'<small class="rank-desk-note">'+escape(row.note)+'</small>':'')+'</td><td>'+escape(row.rating)+'</td>'+
   '<td class="rank-record">'+escape(row.record)+'</td>'+(row.extra?'<td class="rank-explanation">'+row.extra+'</td>':'')+'</tr>';
 }
 function rankingTable(rows,bodyId=''){
  return '<div class="slt-edition-rankings"><div class="rank-table-wrap rank-table-wrap--retro"><table class="rank-table"><thead><tr>'+
   '<th>Rank</th><th>Team</th><th>RETRO Rating</th><th>W–L</th>'+(rows.some(row=>row.extra)?'<th>Statistics</th>':'')+
   '</tr></thead><tbody'+(bodyId?' id="'+escape(bodyId)+'"':'')+'>'+rows.map(rankingRow).join('')+'</tbody></table></div></div>';
 }
 function standingsTable(headers,rows){
  return '<div class="conference-ledger-scroll"><table class="conference-ledger slt-edition-standings"><thead><tr>'+
   headers.map(label=>'<th scope="col">'+escape(label)+'</th>').join('')+'</tr></thead><tbody>'+rows.map((row,index)=>
    '<tr><td><span class="ledger-place">'+(index+1)+'</span></td><td><span class="slt-standing-team">'+(row.badge||'')+
    (row.href?'<a href="'+escape(row.href)+'">'+escape(row.name)+'</a>':escape(row.name))+'</span></td>'+
    row.values.map(value=>'<td>'+escape(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }
 root.SLTBasketballDeskLayout={schedule,rankBadge,rankingRow,rankingTable,standingsTable};
})(typeof window!=='undefined'?window:globalThis);

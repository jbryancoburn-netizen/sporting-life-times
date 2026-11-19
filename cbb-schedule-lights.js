/* Verified schedule form and series. */
(function(){
 const shortSchool=name=>{
  const value=String(name||'').trim();
  const exact={'Tennessee Tech':'Tenn. Tech','Tennessee State':'Tenn. St.','Michigan State':'Mich. St.','Ohio State':'Ohio St.','Penn State':'Penn St.','Indiana State':'Indiana St.','Kentucky State':'Kentucky St.','Western Michigan':'W. Michigan','Eastern Michigan':'E. Michigan','Central Michigan':'C. Michigan','Western Illinois':'W. Illinois','Eastern Illinois':'E. Illinois','Southern Illinois':'S. Illinois','Northern Illinois':'N. Illinois','North Carolina':'N. Carolina','South Carolina':'S. Carolina','Southern California':'USC','Louisiana State':'LSU'};
  if(exact[value])return exact[value];
  return value.replace(/\\bUniversity\\b/gi,'Univ.').replace(/\\bState\\b/gi,'St.').replace(/\\bNorthern\\b/gi,'N.').replace(/\\bSouthern\\b/gi,'S.').replace(/\\bEastern\\b/gi,'E.').replace(/\\bWestern\\b/gi,'W.').replace(/\\bCentral\\b/gi,'C.');
 };
 const valid=g=>g.home_score!=null&&g.away_score!=null&&Number.isFinite(+g.home_score)&&Number.isFinite(+g.away_score)&&+g.home_score!==+g.away_score;
 const won=(g,id)=>(g.home_id===String(id))===(+g.home_score>+g.away_score);
 const ordered=(games,day)=>games.filter(g=>g.date<day&&valid(g)).sort((a,b)=>b.date.localeCompare(a.date));
 const score=(g,id)=>g.home_id===String(id)?g.home_score+'–'+g.away_score:g.away_score+'–'+g.home_score;
 const gameLink=(g,women)=>/^\d+$/.test(String(g.id||'').replace(/^espn:/,''))?'ncaam-slate.html?'+(women?'gender=women&':'')+'date='+encodeURIComponent(g.date)+'&game='+encodeURIComponent(String(g.id).replace(/^espn:/,'')):'';
 function retroHistory(model){
  const engine=window.MBB_RETRO;
  const baseline=Number(model?.starting_elo),homeEdge=Number(model?.parameters?.home_edge),passes=Number(model?.parameters?.passes);
  if(model?.model!=='retro-clean-slate'||!Array.isArray(model.events)||!engine?.calculate||
    baseline!==1500||!Number.isFinite(homeEdge)||!Number.isInteger(passes)||passes<1||passes>300)return ()=>new Map();
  const events=model.events.filter(g=>/^\d{4}-\d{2}-\d{2}$/.test(g.date)&&g.home_id&&g.away_id&&valid(g));
  const snapshots=new Map(),option={baseline,homeEdge,passes};
  const normalize=id=>String(id||'').replace(/^espn:/,'');
  return (day,gameId,team,opponent)=>{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return new Map();
   const pair=g=>[String(g.home_id),String(g.away_id)].includes(String(team))&&[String(g.home_id),String(g.away_id)].includes(String(opponent));
   const final=gameId&&opponent?events.find(g=>g.date===day&&normalize(g.id)===normalize(gameId)&&pair(g)):null;
   const preceding=events.filter(g=>g.date<day);
   const snapshotKey=preceding.length;
   if(!snapshots.has(snapshotKey)){
    snapshots.set(snapshotKey,{prior:preceding,before:engine.calculate(preceding,option).ratings,after:new Map()});
   }
   const {prior,before,after}=snapshots.get(snapshotKey);
   if(final&&!after.has(final.id))after.set(final.id,engine.calculate([...prior,final],option).ratings);
   const result=final?after.get(final.id):null;
   return new Map([team,opponent].filter(Boolean).map(id=>{
    const elo=Math.round(before[id]??baseline),end=result?Math.round(result[id]??baseline):null;
    return [String(id),{elo,end,change:end===null?null:end-elo}];
   }));
  };
 }
 window.SLTScheduleLights={
  retroHistory,
  form(games,ids,day,ratings,esc,women,names){
   const before=ordered(games,day);
   const rows=ids.map(([id,name])=>{
    if(!id||!name)return '';
    const past=before.filter(g=>[g.home_id,g.away_id].includes(String(id)));
    const recent=past.slice(0,5).reverse();
    const outcome=past[0]&&won(past[0],id),change=past.findIndex(g=>won(g,id)!==outcome);
    const streak=past.length?(outcome?'W':'L')+(change<0?past.length:change):'—';
    const rating=ratings.get(String(id)),delta=rating?.change;
    if(!past.length&&!rating)return '';
    const dots='<span class="sched-lights">'+ '<span class="sched-light sched-light-empty" aria-hidden="true"></span>'.repeat(5-recent.length)+recent.map(g=>{
      const win=won(g,id),other=g.home_id===String(id)?g.away_id:g.home_id;
      const label=(win?'Win':'Loss')+' vs '+(names.get(String(other))||'opponent')+' '+score(g,id)+' · '+g.date;
      const link=gameLink(g,women),cls='sched-light sched-light-'+(win?'win':'loss');
      return link?'<a class="'+cls+'" href="'+esc(link)+'" title="'+esc(label)+'" aria-label="'+esc(label)+'"></a>':'<span class="'+cls+'" role="img" title="'+esc(label)+'" aria-label="'+esc(label)+'"></span>';
    }).join('')+'</span>';
    return '<span class="sched-form-line"><b title="'+esc(name)+'">'+esc(shortSchool(name))+'</b>'+dots+'<b>'+streak+'</b><b title="Pregame RETRO'+(rating?.end!=null?' · Final '+rating.end:'')+'">'+(rating?.elo??'—')+'</b><b class="sched-retro-'+(delta>0?'up':'down')+'">'+(Number.isFinite(delta)?(delta>0?'+':'')+delta:'—')+'</b></span>';
   }).join('');
   return rows?'<span class="sched-form-labels" aria-hidden="true"><span>Team</span><span>Last 5</span><span>Run</span><span>RETRO</span><span title="RETRO change after this game">Δ</span></span>'+rows:'';
  },
  corner(games,self,other,day,women,esc){
   const prior=self&&other?ordered(games,day).filter(g=>[g.home_id,g.away_id].includes(String(self))&&[g.home_id,g.away_id].includes(String(other))):[];
   if(!prior.length)return '<div class="sched-corner" hidden></div>';
   const wins=prior.filter(g=>won(g,self)).length,latest=prior[0],link=gameLink(latest,women);
   const result=(won(latest,self)?'W ':'L ')+score(latest,self);
   return '<div class="sched-corner"><span>This season’s series</span><b>'+wins+'–'+(prior.length-wins)+' · '+prior.length+' '+(prior.length===1?'meeting':'meetings')+'</b><small>Last meeting '+(link?'<a href="'+esc(link)+'">'+esc(result)+'</a>':esc(result))+'</small></div>';
  }
 };
})();

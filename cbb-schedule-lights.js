/* Verified schedule form and series. */
(function(){
 const valid=g=>g.home_score!=null&&g.away_score!=null&&Number.isFinite(+g.home_score)&&Number.isFinite(+g.away_score)&&+g.home_score!==+g.away_score;
 const won=(g,id)=>(g.home_id===String(id))===(+g.home_score>+g.away_score);
 const ordered=(games,day)=>games.filter(g=>g.date<day&&valid(g)).sort((a,b)=>b.date.localeCompare(a.date));
 const score=(g,id)=>g.home_id===String(id)?g.home_score+'–'+g.away_score:g.away_score+'–'+g.home_score;
 const gameLink=(g,women)=>/^\d+$/.test(String(g.id||'').replace(/^espn:/,''))?'ncaam-slate.html?'+(women?'gender=women&':'')+'date='+encodeURIComponent(g.date)+'&game='+encodeURIComponent(String(g.id).replace(/^espn:/,'')):'';
 window.SLTScheduleLights={
  form(games,ids,day,ratings,esc,upcoming,women,names){
   const before=ordered(games,day);
   const rows=ids.map(([id,name])=>{
    if(!id||!name)return '';
    const past=before.filter(g=>[g.home_id,g.away_id].includes(String(id)));
    const recent=past.slice(0,5).reverse();
    const outcome=past[0]&&won(past[0],id),change=past.findIndex(g=>won(g,id)!==outcome);
    const streak=past.length?(outcome?'W':'L')+(change<0?past.length:change):'—';
    const rating=upcoming?ratings.get(String(id)):null,delta=Number(Number(rating?.daily_change).toFixed(1));
    if(!past.length&&!rating)return '';
    const dots='<span class="sched-lights">'+ '<span class="sched-light sched-light-empty" aria-hidden="true"></span>'.repeat(5-recent.length)+recent.map(g=>{
      const win=won(g,id),other=g.home_id===String(id)?g.away_id:g.home_id;
      const label=(win?'Win':'Loss')+' vs '+(names.get(String(other))||'opponent')+' '+score(g,id)+' · '+g.date;
      const link=gameLink(g,women),cls='sched-light sched-light-'+(win?'win':'loss');
      return link?'<a class="'+cls+'" href="'+esc(link)+'" title="'+esc(label)+'" aria-label="'+esc(label)+'"></a>':'<span class="'+cls+'" role="img" title="'+esc(label)+'" aria-label="'+esc(label)+'"></span>';
    }).join('')+'</span>';
    return '<span class="sched-form-line"><b>'+esc(name)+'</b>'+dots+'<b>'+streak+'</b><b>'+ (rating?.elo!=null&&Number.isFinite(+rating.elo)?Math.round(+rating.elo):'—')+'</b><b class="sched-retro-'+(delta>0?'up':'down')+'">'+(Number.isFinite(delta)&&delta!==0?(delta>0?'+':'')+delta:'—')+'</b></span>';
   }).join('');
   return rows?'<span class="sched-form-labels" aria-hidden="true"><span>Team</span><span>Last 5</span><span>Run</span><span>RETRO</span><span>Δ</span></span>'+rows:'';
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

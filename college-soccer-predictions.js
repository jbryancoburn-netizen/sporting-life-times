/* Prospective NCAA college soccer forecasts. Research-only; source IDs are clickable. */
(async function(){
  const node=document.getElementById("college-soccer-predictions");
  if(!node)return;
  const status=document.getElementById("college-soccer-predictions-status");
  const table=document.getElementById("college-soccer-predictions-list");
  function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;}
  try{
    const r=await fetch("data/college-soccer-prospective-v2.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw Error("Pregame ledger unavailable");
    const d=await r.json();
    if(d.model!=="ncaa_matchup_draw_v2")throw Error("Expected matchup draw model");
    let current=d;
    const modelChoice=el("select");modelChoice.setAttribute("aria-label","Forecast model archive");
    for(const [key,label] of [["v2","Current matchup model"],["v1","Original fixed-draw archive"]]){
      const o=el("option",label);o.value=key;modelChoice.append(o);
    }
    if(d.status!=="prospective_research_only"||!Array.isArray(d.forecasts))throw Error("Prediction release is unverified");
    let finals=[];
    try{
      const response=await fetch("data/college-soccer-elo-final-ledger.json?t="+Date.now(),{cache:"no-store"});
      if(response.ok)finals=(await response.json()).results||[];
    }catch(e){}
    const finalById=new Map(finals.map(g=>[g.match_id,g]));
    function pick(g){
      const outcomes=[[g.away_name,g.p_away],["Draw",g.p_draw],[g.home_name,g.p_home]];
      const best=Math.max(...outcomes.map(x=>x[1]));
      const winners=outcomes.filter(x=>x[1]===best);
      return winners.length===1?winners[0][0]+" ("+(100*best).toFixed(1)+"%)":"No clear pick";
    }
    function result(g){
      const f=finalById.get(g.match_id);
      if(!f)return Date.parse(g.kickoff_utc)>Date.now()?"Upcoming":"Awaiting final";
      if(f.home_team!==g.home_team||f.away_team!==g.away_team)return "Result under review";
      const winner=f.home_goals===f.away_goals?"Draw":f.home_goals>f.away_goals?g.home_name+" won":g.away_name+" won";
      return winner+" · "+g.away_name+" "+f.away_goals+", "+g.home_name+" "+f.home_goals;
    }
    let selected="men-d1";
    const controls=el("div",undefined,"college-elo-controls");
    const options=el("select");options.setAttribute("aria-label","Select NCAA soccer division");
    for(const key of ["men-d1","men-d2","men-d3","women-d1","women-d2","women-d3"]){
      const o=el("option",(key.startsWith("men")?"Men":"Women")+" · Division "+["","I","II","III"][Number(key.slice(-1))]);
      o.value=key;options.append(o);
    }
    controls.append(options,modelChoice);
    const summary=el("p",undefined,"college-elo-note");
    let page=0, view="upcoming";
    const views=el("select");views.setAttribute("aria-label","Select forecast window");
    for(const [key,label] of [["upcoming","Upcoming"],["results","Completed"],["all","All forecasts"]]){
      const option=el("option",label);option.value=key;views.append(option);
    }
    controls.append(views);
    const render=()=>{
      table.replaceChildren();
      status.textContent=(current===d?"Matchup model v2":"Original fixed-draw model v1")+" · "+current.count_locked+" archived pregame forecasts · Research estimates"+(current===d&&d.source_status&&d.source_status!=="complete"?" · Schedule feed incomplete":"");
      const all=current.forecasts.filter(g=>g.cohort===selected&&(view==="all"||(view==="results"?finalById.has(g.match_id):Date.parse(g.kickoff_utc)>Date.now())))
        .sort((a,b)=>view==="results"?Date.parse(b.kickoff_utc)-Date.parse(a.kickoff_utc):Date.parse(a.kickoff_utc)-Date.parse(b.kickoff_utc));
      const pages=Math.max(1,Math.ceil(all.length/12));page=Math.min(page,pages-1);
      summary.textContent=all.length+" "+(view==="results"?"completed matchups":view==="upcoming"?"upcoming matchups":"archived forecasts")+(current===d?" · Matchup-specific draw probabilities":" · Original fixed-draw estimates, retained for comparison");
      if(!all.length){table.append(el("p","No "+view+" forecasts in this division.","forecast-empty"));return;}
      const grid=el("div",undefined,"forecast-match-grid");
      for(const g of all.slice(page*12,page*12+12)){
        const card=el("article",undefined,"forecast-match-card");
        const header=el("div",undefined,"forecast-card-top");
        header.append(el("span",finalById.has(g.match_id)?"Final":"Pregame"),el("time",new Date(g.kickoff_utc).toLocaleString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})+" ET"));
        const matchup=el("div",undefined,"forecast-matchup");
        for(const [name,side,slug] of [[g.away_name,"Away",g.away_team],[g.home_name,"Home",g.home_team]]){
          const team=el("div",undefined,"forecast-team");
          const monogram=name.split(/\s+/).slice(0,2).map(w=>w[0]).join("");
          const badge=el("span",monogram,"forecast-monogram");badge.setAttribute("aria-hidden","true");
          const logo=el("img");
          logo.alt="";logo.width=64;logo.height=64;logo.loading="lazy";logo.decoding="async";
          logo.style.cssText="width:64px;height:64px;object-fit:contain;display:block;margin:auto";
          logo.addEventListener("error",()=>{logo.replaceWith(badge);},{once:true});
          logo.src="https://www.ncaa.com/sites/default/files/images/logos/schools/bgl/"+encodeURIComponent(slug)+".svg";
          team.append(logo,el("h3",name),el("small",side));matchup.append(team);
        }
        const prediction=el("div",undefined,"forecast-pick");
        prediction.append(el("span","Our pick"),el("strong",pick(g)));
        const probabilities=el("div",undefined,"forecast-probabilities");
        for(const [name,p] of [[g.away_name,g.p_away],["Draw",g.p_draw],[g.home_name,g.p_home]]){
          const row=el("div",undefined,"forecast-probability");
          const label=el("div",undefined,"forecast-probability-label");label.append(el("span",name),el("strong",(p*100).toFixed(1)+"%"));
          const track=el("div",undefined,"forecast-probability-track"),fill=el("span");
          fill.style.width=(p*100)+"%";track.append(fill);row.append(label,track);probabilities.append(row);
        }
        const footer=el("div",undefined,"forecast-card-footer");
        const anchor=el("a","NCAA game ↗");anchor.href=g.source_game;anchor.target="_blank";anchor.rel="noopener noreferrer";
        footer.append(el("span",result(g)),anchor);
        card.append(header,matchup,prediction,probabilities,footer);grid.append(card);
      }
      table.append(grid);
      if(pages>1){
        const nav=el("nav",undefined,"forecast-pagination");nav.setAttribute("aria-label","Forecast pages");
        const prev=el("button","← Previous"),next=el("button","Next →");
        prev.type=next.type="button";prev.disabled=page===0;next.disabled=page===pages-1;
        prev.addEventListener("click",()=>{page--;render();});next.addEventListener("click",()=>{page++;render();});
        nav.append(prev,el("span",(page+1)+" / "+pages),next);table.append(nav);
      }
    };
    modelChoice.addEventListener("change",async()=>{
      if(modelChoice.value==="v1"){
        try{
          const response=await fetch("data/college-soccer-prospective.json?t="+Date.now(),{cache:"no-store"});
          if(!response.ok)throw Error("archive unavailable");
          const archive=await response.json();
          if(archive.status!=="prospective_research_only"||!Array.isArray(archive.forecasts))throw Error("invalid archive");
          current=archive;
        }catch(e){modelChoice.value="v2";current=d;status.textContent="Original archive unavailable; showing current matchup model.";}
      }else current=d;
      page=0;render();
    });
    views.addEventListener("change",()=>{view=views.value;page=0;render();});
    options.addEventListener("change",()=>{selected=options.value;page=0;render();});
    table.before(controls,summary);
    status.textContent="Matchup model v2 · "+d.count_locked+" pregame forecasts archived · Research estimates";
    render();
  }catch(e){status.textContent="No independently verified pregame forecast feed is available.";table.replaceChildren();}
})();
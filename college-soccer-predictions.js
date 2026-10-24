/* Prospective NCAA college soccer forecasts. Research-only; source IDs are clickable. */
(async function(){
  const node=document.getElementById("college-soccer-predictions");
  if(!node)return;
  const status=document.getElementById("college-soccer-predictions-status");
  const table=document.getElementById("college-soccer-predictions-list");
  function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;}
  try{
    const r=await fetch("data/college-soccer-prospective.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw Error("Pregame ledger unavailable");
    const d=await r.json();
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
    controls.append(options);
    const summary=el("p",undefined,"college-elo-note");
    const render=()=>{
      table.replaceChildren();
      const filtered=d.forecasts.filter(x=>x.cohort===selected).slice(0,35);
      summary.textContent=filtered.length+" archived forecasts shown in this division.";
      if(!filtered.length){table.append(el("p","No pregame forecasts in the published window for this division."));return;}
      const grid=el("div",undefined,"college-elo-scroll"),t=el("table",undefined,"college-elo-table"),thead=el("thead"),hdr=el("tr");
      for(const h of ["Kickoff (ET)","Match","Predicted winner","Win / draw chances","Result"]){hdr.append(el("th",h));}thead.append(hdr);t.append(thead);
      const body=el("tbody");
      for(const g of filtered){
        const tr=el("tr");
        const when=new Date(g.kickoff_utc).toLocaleString("en-US",{timeZone:"America/New_York",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
        for(const v of [when,g.away_name+" at "+g.home_name,pick(g),g.away_name+" "+(100*g.p_away).toFixed(1)+"% · Draw "+(100*g.p_draw).toFixed(1)+"% · "+g.home_name+" "+(100*g.p_home).toFixed(1)+"%",result(g)]){
          const td=el("td",v);tr.append(td);
        }
        const anchor=el("a","NCAA","college-elo-source");
        anchor.href=g.source_game;anchor.target="_blank";anchor.rel="noopener noreferrer";
        tr.children[1].append(" ",anchor);
        body.append(tr);
      }
      t.append(body);grid.append(t);table.append(grid);
    };
    options.addEventListener("change",()=>{selected=options.value;render();});
    node.append(controls,summary);
    status.textContent="Research forecasts · "+d.count_locked+" timestamped pregame predictions archived · Original predictions retained alongside available final results.";
    render();
  }catch(e){status.textContent="No independently verified pregame forecast feed is available.";table.replaceChildren();}
})();
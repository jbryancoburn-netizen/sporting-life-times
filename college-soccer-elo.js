/* Independent USRS college soccer Elo newspaper view. No invented scores. */
(async function collegeSoccerEloDesk(){
  const host=document.getElementById('college-soccer-elo');
  if (!host) return;
  const status=document.getElementById('college-soccer-elo-status');
  const selector=document.getElementById('college-soccer-elo-controls');
  const tableHost=document.getElementById('college-soccer-elo-table');
  let gender='men',division=1;
  const datasetURL='data/college-soccer-elo.json';

  function el(tag,text,cls){
    const item=document.createElement(tag);
    if(cls)item.className=cls;
    if(text!==undefined && text!==null)item.textContent=String(text);
    return item;
  }
  function button(label,active,onClick){
    const b=el('button',label,'college-elo-button'+(active?' is-selected':''));
    b.type='button';b.setAttribute('aria-pressed',String(active));b.addEventListener('click',onClick);return b;
  }
  function makeCell(tag,value,cls){
    const td=el(tag,value,cls);
    if(cls && cls.includes('numeric'))td.style.fontVariantNumeric='tabular-nums';
    return td;
  }
  try{
    const response=await fetch(datasetURL+'?t='+Date.now(),{cache:'no-store'});
    if (!response.ok) throw Error('Ratings feed not published ('+response.status+')');
    const model=await response.json();
    if (!model || !model.cohorts || model.status!=='provisional') throw Error('Invalid Elo release');
    const groups=model.cohorts;
    const render=()=>{
      const key=gender+'-d'+division;
      const rows=groups[key];
      if (!Array.isArray(rows)||!rows.length){tableHost.replaceChildren(el('p','No verified ratings are available for this group.'));return;}
      const genderControls=el('div',null,'college-elo-button-group');
      for(const entry of [['men',"Men's"],['women',"Women's"]]){
        genderControls.append(button(entry[1],entry[0]===gender,()=>{gender=entry[0];render();}));
      }
      const divisionControls=el('div',null,'college-elo-button-group');
      for(const d of [1,2,3]){
        divisionControls.append(button('Division '+['','I','II','III'][d],d===division,()=>{division=d;render();}));
      }
      selector.replaceChildren(genderControls,divisionControls);
      const header=el('div',null,'college-elo-table-header');
      header.append(el('h3',(gender==='men'?"Men's":"Women's")+' · Division '+['','I','II','III'][division]));
      header.append(el('span',rows.length+' rated programs · '+rows.reduce((x,r)=>x+Number(r.gp||0),0)/2+' completed matches'));
      const scroll=el('div',null,'college-elo-scroll');
      const table=el('table',null,'college-elo-table');
      const thead=el('thead'),heads=el('tr');
      for(const [name,cls] of [['#','numeric'],['School',''],['Elo','numeric'],['W-L-T','numeric'],['GP','numeric'],['GD','numeric']]){
        heads.append(makeCell('th',name,cls));
      }
      thead.append(heads);
      const tbody=el('tbody');
      for(const entry of rows){
        const tr=el('tr');
        tr.append(makeCell('td',entry.rank,'numeric'));
        tr.append(makeCell('td',entry.team,'college-elo-school'));
        tr.append(makeCell('td',Number(entry.elo).toFixed(1),'numeric'));
        tr.append(makeCell('td',entry.record,'numeric'));
        tr.append(makeCell('td',entry.gp,'numeric'));
        tr.append(makeCell('td',entry.gd>=0?'+'+entry.gd:entry.gd,'numeric'));
        tbody.append(tr);
      }
      table.append(thead,tbody);scroll.append(table);tableHost.replaceChildren(header,scroll);
    };
    status.textContent='Updated through '+model.as_of+' · Provisional Elo · Source: NCAA.com final scores';
    const note=document.getElementById('college-soccer-elo-note');
    if(note){note.textContent='Independent USRS Elo ratings, not NCAA RPI or a coaches poll. Each division is a separate rating pool. Neutral-site and historical completeness audits are ongoing; probabilities are not certified betting lines.';}
    render();
  }catch(err){
    status.textContent='College soccer ratings are temporarily unavailable.';
    tableHost.replaceChildren(el('p','The verified rating feed could not be loaded. Scores and rankings have not been fabricated.'));
    console.warn('College soccer Elo:',err);
  }
})();

/* EuroLeague NBA-parity repair.
 * Keep large dashboards in their original wide containers.
 * Columnize only the news and the two compact ranking tables.
 * All source-backed IDs remain attached to their original nodes.
 */
(()=>{
  'use strict';
  function organize(){
    const main=document.querySelector('body[data-league="euroleague"].nba-parity-paper main.league-hub');
    if(!main||main.querySelector('.slt-paper-columns'))return;
    const sections=['#league-news','#el-ratings','#el-standings-panel']
      .map(selector=>main.querySelector(selector));
    if(sections.some(section=>!section))return;
    const layout=document.createElement('div');
    layout.className='slt-paper-columns slt-euroleague-columns';
    for(let index=0;index<3;index++){
      const column=document.createElement('div');
      column.className='slt-paper-column';
      column.dataset.column=String(index+1);
      column.appendChild(sections[index]);
      layout.appendChild(column);
    }
    main.querySelector('#el-front-strip')?.insertAdjacentElement('afterend',layout);
    if(!layout.isConnected){main.querySelector('#el-live-desk')?.insertAdjacentElement('afterend',layout);}
    document.body.classList.add('slt-reflowed','slt-euroleague-fixed');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',organize,{once:true});
  else organize();
})();
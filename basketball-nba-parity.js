/* Columnize the EuroLeague existing sections to match the NBA newspaper.
   Move nodes, never clone them: live data refreshes keep their original IDs. */
(()=>{'use strict';
function organize(){
 const main=document.querySelector('body[data-league="euroleague"].nba-parity-paper main.league-hub');
 if(!main||main.querySelector('.slt-paper-columns'))return;
 const lead=main.querySelector('#league-news');
 if(!lead)return;
 const layout=document.createElement('div');layout.className='slt-paper-columns';
 const cols=[0,1,2].map(i=>{const div=document.createElement('div');div.className='slt-paper-column';div.dataset.column=String(i+1);layout.appendChild(div);return div;});
 lead.before(layout);
 const assignments=[
  ['#league-news','#league-boxscores','#league-data-links'],
  ['#el-ratings','.el-player-desk','#el-insights'],
  ['#el-standings-panel','.el-club-spotlight','#el-predictions']
 ];
 const all=assignments.map(a=>a.map(selector=>main.querySelector(selector)));
 if(all.some(group=>group.some(element=>!element))){layout.remove();return;}
 all.forEach((group,i)=>group.forEach(el=>cols[i].appendChild(el)));
 document.body.classList.add('slt-reflowed');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',organize,{once:true});else organize();
})();

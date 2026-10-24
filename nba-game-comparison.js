/* Honest game comparisons: percentage-point gaps, neutral scales and observed advantages. */
(function(root){
'use strict';
const metrics=[
 {key:'FG%',name:'Field goals',unit:'%',cap:100,direction:1},
 {key:'3PT%',name:'Three-point shooting',unit:'%',cap:100,direction:1},
 {key:'FT%',name:'Free throws',unit:'%',cap:100,direction:1},
 {key:'REB',name:'Rebounds',unit:'',direction:1},
 {key:'AST',name:'Assists',unit:'',direction:1},
 {key:'TO',name:'Turnovers',unit:'',direction:-1},
 {key:'PAINT',name:'Points in paint',unit:'',direction:1},
 {key:'FAST BREAK',name:'Fast-break points',unit:'',direction:1},
 {key:'BENCH',name:'Bench points',unit:'',direction:1}
];
function analyze(game){
 const data=game?.team_comparison;
 if(!data?.away||!data?.home)return [];
 const out=[];
 for(const m of metrics){
  const a=data.away[m.key],h=data.home[m.key];
  if(typeof a!=='number'||typeof h!=='number'||!Number.isFinite(a)||!Number.isFinite(h)||a<0||h<0)continue;
  if(m.cap&&(a>m.cap||h>m.cap))continue;
  const gap=+(a-h).toFixed(1);
  const advantage=gap===0?'even':(gap*m.direction>0?'away':'home');
  // Percentages always use a fixed 0–100 scale. Totals use a shared 0–max scale.
  const scale=m.cap||Math.max(a,h,1);
  out.push({...m,away:a,home:h,gap,advantage,awayWidth:100*a/scale,homeWidth:100*h/scale});
 }
 return out;
}
root.SLTGameComparison={analyze};
if(typeof module!=='undefined')module.exports={analyze};
})(typeof window!=='undefined'?window:globalThis);

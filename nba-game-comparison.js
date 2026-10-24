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
function shooting(game){
 const result={};
 for(const team of game?.teams||[]){
  const side=team.home_away;
  const players=(game.players||[]).filter(p=>p.team===team.code);
  if(!['away','home'].includes(side)||!players.length)continue;
  const keys=['pts','fgm','fga','fg3m','fg3a','ftm','fta'];
  if(!players.every(p=>keys.every(k=>Number.isInteger(p[k])&&p[k]>=0)))continue;
  const t=Object.fromEntries(keys.map(k=>[k,players.reduce((a,p)=>a+p[k],0)]));
  if(t.pts!==Number(team.score)||t.fgm>t.fga||t.fg3m>t.fg3a||t.ftm>t.fta||t.fg3m>t.fgm||t.fg3a>t.fga)continue;
  if(t.pts!==2*t.fgm+t.fg3m+t.ftm||!t.fga)continue;
  const denominator=2*(t.fga+0.44*t.fta);
  result[side]={
   'eFG%':+(100*(t.fgm+0.5*t.fg3m)/t.fga).toFixed(1),
   ...(denominator>0?{'TS%':+(100*t.pts/denominator).toFixed(1)}:{}),
   '3PA RATE':+(100*t.fg3a/t.fga).toFixed(1),
   'FT RATE':+(100*t.fta/t.fga).toFixed(1)
  };
 }
 return result;
}
function analyze(game){
 const data=game?.team_comparison;
 if(!data?.away||!data?.home)return [];
 const advanced=shooting(game);
 const out=[];
 for(const m of metrics){
  const a=data.away[m.key],h=data.home[m.key];
  if(typeof a!=='number'||typeof h!=='number'||!Number.isFinite(a)||!Number.isFinite(h)||a<0||h<0)continue;
  if(m.cap&&(a>m.cap||h>m.cap))continue;
  const gap=+(a-h).toFixed(1);
  const advantage=gap===0?'even':(gap*m.direction>0?'away':'home');
  // Percentages always use a fixed 0–100 scale. Totals use a shared 0–max scale.
  const scale=m.cap||Math.max(a,h,1);
  out.push({...m,away:a,home:h,gap,advantage,awayWidth:Math.min(100,100*a/scale),homeWidth:Math.min(100,100*h/scale)});
 }
 const extra=[
  {key:'eFG%',name:'Effective FG%',unit:'%',cap:100,direction:1},
  {key:'TS%',name:'True shooting',unit:'%',direction:1},
  {key:'3PA RATE',name:'Three-point attempt rate',unit:'%',cap:100,direction:0},
  {key:'FT RATE',name:'Free-throw attempt rate',unit:'%',direction:0}
 ];
 for(const m of extra){
  const a=advanced.away?.[m.key],h=advanced.home?.[m.key];
  if(!Number.isFinite(a)||!Number.isFinite(h)||a<0||h<0)continue;
  const scale=m.cap||Math.max(100,a,h);
  out.push({...m,away:a,home:h,gap:+(a-h).toFixed(1),advantage:m.direction===0?'even':a===h?'even':a>h?'away':'home',awayWidth:Math.min(100,100*a/scale),homeWidth:Math.min(100,100*h/scale)});
 }
 return out;
}
root.SLTGameComparison={analyze,shooting};
if(typeof module!=='undefined')module.exports={analyze,shooting};
})(typeof window!=='undefined'?window:globalThis);

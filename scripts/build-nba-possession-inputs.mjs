#!/usr/bin/env node
// Convert ONLY official NBA box-score team statistics into independent scoring inputs.
import {readFileSync,writeFileSync} from 'node:fs';
const base=new URL('../data/',import.meta.url),input=new URL('nba-game-center.json',base);
const raw=JSON.parse(readFileSync(input,'utf8'));
const result={source_type:'official_nba_boxscores',source_url:'https://cdn.nba.com/static/json/liveData/boxscore/',updated_at:raw.updated_at,coverage:'captured completed games, not necessarily full NBA season',games:[]};
for(const g of raw.games||[]){
 if(g.state!=='post'||!/^002\d{7}$/.test(String(g.id)))continue;
 const h=g.official_stats?.home,a=g.official_stats?.away;
 const valid=t=>t&&typeof t.code==='string'&&['points','fga','oreb','tov','fta'].every(k=>Number.isFinite(t[k])&&t[k]>=0);
 if(!valid(h)||!valid(a))continue;
 result.games.push({id:g.id,date:g.date,final:true,regular_season:true,home:h,away:a});
}
const ids=new Set(result.games.map(g=>g.id));if(ids.size!==result.games.length)throw Error('Duplicate NBA official possession games');
writeFileSync(new URL('nba-possession-inputs.json',base),JSON.stringify(result,null,2)+'\n');
console.log('NBA possession inputs: '+result.games.length+' official completed regular-season box scores');

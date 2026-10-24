#!/usr/bin/env node
// Convert attributed, reconciled NBA team box scores into independent scoring inputs.
import {readFileSync,writeFileSync} from 'node:fs';
const base=new URL('../data/',import.meta.url),input=new URL('nba-game-center.json',base);
const raw=JSON.parse(readFileSync(input,'utf8'));
const result={source_type:'attributed_nba_boxscores',source_url:'Attribution retained per game',updated_at:raw.updated_at,coverage:'captured completed games, not necessarily full NBA season',games:[]};
for(const g of raw.games||[]){
 if(g.state!=='post')continue;
 const official=/^002\d{7}$/.test(String(g.id));
 const espn=/^espn-nba-\d+$/.test(String(g.id))&&g.possession_stats?.regular_season===true&&g.possession_stats?.season==='2026-27'&&g.possession_stats?.source_url?.startsWith('https://site.api.espn.com/');
 if(!official&&!espn)continue;
 const stats=official?g.official_stats:g.possession_stats;
 const h=stats?.home,a=stats?.away;
 const valid=t=>t&&typeof t.code==='string'&&['points','fga','oreb','tov','fta'].every(k=>Number.isFinite(t[k])&&t[k]>=0);
 if(!valid(h)||!valid(a)||h.code===a.code)continue;
 if(!['home','away'].every(side=>{const team=g.teams?.find(t=>t.home_away===side);return team?.code===stats[side].code&&Number(team.score)===stats[side].points;}))throw Error('Possession inputs conflict with final '+g.id);
 result.games.push({id:g.id,date:g.date,final:true,regular_season:true,source:official?'NBA official box score':stats.source,source_url:official?'https://cdn.nba.com/static/json/liveData/boxscore/'+g.id+'.json':stats.source_url,home:h,away:a});
}
const calibration=JSON.parse(readFileSync(new URL('nba-possession-historical-calibration.json',base),'utf8'));
if(calibration.status!=='historical_possession_diagnostic'||calibration.untouched_test_games<400)throw Error('Historical scoring evidence missing');
result.calibration=calibration;
const ids=new Set(result.games.map(g=>g.id));if(ids.size!==result.games.length)throw Error('Duplicate NBA official possession games');
writeFileSync(new URL('nba-possession-inputs.json',base),JSON.stringify(result,null,2)+'\n');
console.log('NBA possession inputs: '+result.games.length+' attributed completed regular-season box scores');

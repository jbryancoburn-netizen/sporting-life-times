import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {render}=require('../nba-scorebug.js');
const away={code:'CHI',name:'Chicago Bulls',logo:'https://example.test/chi.png'};
const home={code:'MIL',name:'Milwaukee Bucks',logo:'https://example.test/mil.png'};
function order(html) {
 assert(html.indexOf('>CHI<')>=0 && html.indexOf('>MIL<')>html.indexOf('>CHI<'),'Away must appear first');
 assert(html.indexOf('Chicago Bulls')<html.indexOf('Milwaukee Bucks'),'Away full name must precede home');
}
const final=render({mode:'final',away,home,awayScore:123,homeScore:114,winner:'CHI'});
order(final);
assert(final.indexOf('>123<')<final.indexOf('>114<'));
assert(final.indexOf('is-winner')>0);
const live=render({mode:'live',away,home,awayScore:76,homeScore:80,subtitle:'Q3 5:12'});
order(live);assert(live.includes('LIVE'));assert(!live.includes('PROJECTED'));
const upcoming=render({mode:'upcoming',away,home,subtitle:'7:30 ET'});
order(upcoming);assert(upcoming.includes('UPCOMING'));assert(!upcoming.includes('PROJECTED SCORE'));
const forecast=render({mode:'upcoming',away,home,awayScore:105,homeScore:111,projected:true});
order(forecast);assert(forecast.includes('PROJECTED SCORE'));
assert.throws(()=>render({mode:'final',away,home,awayScore:100}),/requires verified/);
assert.throws(()=>render({mode:'final',away,home,awayScore:100,homeScore:98,projected:true}),/projections/);
assert.throws(()=>render({mode:'live',away,home,projected:true}),/cannot display projected/);
assert.throws(()=>render({mode:'upcoming',away,home,awayScore:100}),/projected=true/);
assert.throws(()=>render({mode:'final',away,home:away,awayScore:100,homeScore:98}),/must differ/);
console.log('PASS: away/home order, finals, live, upcoming, projected scores, invalid-score guards');

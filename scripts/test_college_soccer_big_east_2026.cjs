#!/usr/bin/env node
'use strict';
// BIG EAST 2026 official regular-season divisions and four-team championship.
const fs=require('node:fs'),assert=require('node:assert/strict');
const d=JSON.parse(fs.readFileSync('data/college-soccer-men-d1-big-east-standings.json','utf8'));
const js=fs.readFileSync('college-soccer-conference-page.js','utf8');
const css=fs.readFileSync('college-soccer-conference-page.css','utf8');
const html=fs.readFileSync('college-soccer-big-east-men.html','utf8');
const expected=[
 ['georgetown','East','7-0-1',22,'14-1-2'],
 ['seton-hall','East','4-2-2',14,'7-4-6'],
 ['uconn','East','4-3-1',13,'8-7-3'],
 ['st-johns-ny','East','2-4-2',8,'6-9-2'],
 ['providence','East','1-5-2',5,'6-7-3'],
 ['villanova','East','0-7-1',1,'5-9-3'],
 ['creighton','Midwest','4-1-3',15,'12-1-5'],
 ['akron','Midwest','4-1-3',15,'11-1-4'],
 ['xavier','Midwest','3-2-3',12,'10-2-4'],
 ['butler','Midwest','3-3-2',11,'3-9-3'],
 ['marquette','Midwest','3-5',9,'10-6-1'],
 ['depaul','Midwest','2-4-2',8,'5-6-5'],
];
assert.equal(d.snapshot_checked_date,'2026-11-06','Official table must show FINAL regular-season date');
assert.equal(d.standings_final_date,'2026-11-06');
assert.equal(d.source_url,'https://www.bigeast.com/standings.aspx?standings=1131');
assert.deepEqual(d.rows.map(r=>[r.team_id,r.division,r.conference_record,r.conference_points,r.overall_record]),expected,'Official November 6 standings changed, or two divisions mixed');
const seeds=['georgetown','creighton','akron','seton-hall'];
assert.deepEqual(d.tournament_seeds,seeds,'Conference championship seeds changed');
const b=d.tournament_bracket;
assert.equal(b.status,'official');
assert.equal(b.matches.length,3);
assert(b.source_url.startsWith('https://www.bigeast.com/'));
assert.deepEqual(b.matches.slice(0,2).map(m=>[m.home_id,m.away_id,m.status]),[
 ['creighton','akron','scheduled'],['georgetown','seton-hall','scheduled']
]);
assert.deepEqual(b.matches.slice(0,2).map(m=>m.kickoff),[
 'Nov 12 · 5:00 p.m. ET · ESPN+',
 'Nov 12 · 7:30 p.m. ET · ESPN+'
]);
assert(b.matches.every(m=>m.venue_type==='neutral'),'Every match is at Maryland SoccerPlex');
assert(b.matches.every(m=>m.venue.includes('Boyds')),'Wrong championship venue');
const final=b.matches[2];
assert.equal(final.status,'scheduled');
assert.equal(final.home_id,null,'No unplayed finalist may be invented');
assert.equal(final.away_id,null,'No unplayed finalist may be invented');
assert.deepEqual([final.home_from,final.away_from],['SF1','SF2']);
assert.equal(final.kickoff,'Nov 15 · 2:00 p.m. ET · ESPNU');
assert(js.includes("confirmedFinal?'Official semifinals set · championship pending'"),'Top of page must not label an official bracket unverified');
assert(js.includes("groupHeading.colSpan=5"),'Divisional standings headings are not rendered');
assert(js.includes("const place=key==='men-d1:big-east'?++divisionPosition:i+1"),'Divisional table places must reset');
assert(js.includes("const displayedSchoolRows=Array.from(tb.rows).filter"),'Division headings shift school logos');
assert(!js.includes("link=tb.rows[i]?.cells[1]"),'Wrong crest/row mapping reintroduced');
assert(js.includes('Winner of '),"Future championship must identify semifinal winner paths");
assert(js.includes("match.home_from"),"Championship feeder path missing");
assert(js.includes("titleFixture.venue_type==='neutral'"),'Neutral-site forecast must not use home advantage');
assert(css.includes('cs-conf-division-row th')&&css.includes('cs-conf-winner-slot'),'Separate divisions/championship slots styling missing');
assert(html.includes('data-conference="men-d1:big-east"'),'Wrong conference page');
assert(html.includes('college-soccer-conference-page.js?v=20261112-bigeast-official'),"Cached broken JS still loaded");
assert(html.includes('college-soccer-conference-page.css?v=20261112-bigeast-official'),"Cached old CSS still loaded");
console.log('PASS: 12 final regular-season rows, 2 divisions, 4 confirmed seeds, neutral-site semifinals, correct championship feeder slots and school-logo mapping');

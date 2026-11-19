/* One NCAA Division I men's basketball logo identity + rendering contract. */
(function(w){
'use strict';
// Do not redecorate football or soccer logos in the shared live-game page.
const onVictorianLivePage=/\/live-game\.html$/i.test(String(w.location?.pathname||''));
if(onVictorianLivePage&&!['ncaam','ncaaw'].includes(new URLSearchParams(String(w.location?.search||'')).get('league')))return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
// Exact ESPN identities of the 18 current Big Ten members; no guessed aliases.
// Use real original-era mascot artwork over generic helmets or lettermarks.
const BIG_TEN_HERITAGE=Object.freeze({
 '84':'assets/cbb-big-ten-1980s/centered/indiana.png?v=20261114-bigten-live1',
 '356':'assets/cbb-big-ten-1980s/centered/illinois.png?v=20261114-bigten-live1',
 '2294':'assets/cbb-big-ten-1980s/centered/iowa.png?v=20261114-bigten-live1',
 '130':'assets/cbb-big-ten-1980s/centered/michigan.png?v=20261114-bigten-live1',
 '127':'assets/cbb-big-ten-1980s/centered/michigan-state-gruff.png?v=20261114-gruff-full-art1',
 '135':'assets/cbb-big-ten-1980s/centered/minnesota.png?v=20261114-bigten-live1',
 '77':'assets/cbb-big-ten-1980s/centered/northwestern.png?v=20261114-bigten-live1',
 '194':'assets/cbb-big-ten-1980s/centered/ohio-state.png?v=20261114-bigten-live1',
 '2509':'assets/cbb-big-ten-1980s/centered/purdue.png?v=20261114-bigten-live1',
 '275':'assets/cbb-big-ten-1980s/centered/wisconsin.png?v=20261114-bigten-live1',
 '213':'assets/cbb-big-ten-1980s/centered/penn-state.png?v=20261114-bigten-live1',
 '158':'assets/cbb-big-ten-1980s/centered/nebraska.png?v=20261114-bigten-live1',
 '120':'assets/cbb-big-ten-1980s/centered/maryland-terrapin.png?v=20261114-bigten-live1',
 '164':'assets/cbb-big-ten-1980s/centered/rutgers.png?v=20261114-bigten-live1',
 '26':'assets/cbb-big-ten-1980s/centered/ucla.png?v=20261114-bigten-live1',
 '30':'assets/cbb-big-ten-1980s/centered/usc.png?v=20261114-bigten-live1',
 '2483':'assets/cbb-big-ten-1980s/centered/oregon.png?v=20261114-bigten-live1',
 '264':'assets/cbb-big-ten-1980s/centered/washington.png?v=20261114-bigten-live1'
});
// Exact ACC school IDs, never name-matched or inferred from conference.
// Every vintage emblem is self-hosted, source-provenanced and ring-safe.
const ACC_HERITAGE=Object.freeze({
 '24':'assets/cbb-acc-1980s/stanford.png?v=20261114-acc18-live1',
 '25':'assets/cbb-acc-1980s/california.png?v=20261114-acc18-live1',
 '52':'assets/cbb-acc-1980s/florida-state.png?v=20261114-acc18-live1',
 '59':'assets/cbb-acc-1980s/georgia-tech.png?v=20261114-acc18-live1',
 '87':'assets/cbb-acc-1980s/notre-dame.png?v=20261114-acc18-live1',
 '97':'assets/cbb-acc-1980s/louisville.png?v=20261114-acc18-live1',
 '103':'assets/cbb-acc-1980s/boston-college.png?v=20261114-acc18-live1',
 '150':'assets/cbb-acc-1980s/duke.png?v=20261114-acc18-live1',
 '152':'assets/cbb-acc-1980s/nc-state.png?v=20261114-acc18-live1',
 '153':'assets/cbb-acc-1980s/north-carolina.png?v=20261114-acc18-live1',
 '154':'assets/cbb-acc-1980s/wake-forest.png?v=20261114-acc18-live1',
 '183':'assets/cbb-acc-1980s/syracuse.png?v=20261114-acc18-live1',
 '221':'assets/cbb-acc-1980s/pittsburgh.png?v=20261114-pitt-standing-1980-approved1',
 '228':'assets/cbb-acc-1980s/clemson.png?v=20261114-acc18-live1',
 '258':'assets/cbb-acc-1980s/virginia.png?v=20261114-acc18-live1',
 '259':'assets/cbb-acc-1980s/virginia-tech.png?v=20261114-acc18-live1',
 '2390':'assets/cbb-acc-1980s/miami.png?v=20261114-acc18-live1',
 '2567':'assets/cbb-acc-1980s/smu.png?v=20261114-acc18-live1'
});
const SEC_HERITAGE=Object.freeze({
 '333':'assets/cbb-sec-1980s/alabama.png?v=20261114-sec16-live1',
 '8':'assets/cbb-sec-1980s/arkansas.png?v=20261114-sec16-live1',
 '2':'assets/cbb-sec-1980s/auburn.png?v=20261114-sec16-live1',
 '57':'assets/cbb-sec-1980s/florida.png?v=20261114-sec16-live1',
 '61':'assets/cbb-sec-1980s/georgia.png?v=20261114-sec16-live1',
 '96':'assets/cbb-sec-1980s/kentucky.png?v=20261114-sec16-live1',
 '99':'assets/cbb-sec-1980s/lsu.png?v=20261114-sec16-live1',
 '344':'assets/cbb-sec-1980s/mississippi-state.png?v=20261114-sec16-live1',
 '142':'assets/cbb-sec-1980s/missouri.png?v=20261114-sec16-live1',
 '201':'assets/cbb-sec-1980s/oklahoma.png?v=20261114-sec16-live1',
 '145':'assets/cbb-sec-1980s/ole-miss.png?v=20261114-sec16-live1',
 '2579':'assets/cbb-sec-1980s/south-carolina.png?v=20261114-sec16-live1',
 '2633':'assets/cbb-sec-1980s/tennessee.png?v=20261114-sec16-live1',
 '251':'assets/cbb-sec-1980s/texas.png?v=20261114-sec16-live1',
 '245':'assets/cbb-sec-1980s/texas-am.png?v=20261114-sec16-live1',
 '238':'assets/cbb-sec-1980s/vanderbilt.png?v=20261114-sec16-live1'
});
const BIG_EAST_HERITAGE=Object.freeze({
 '2086':'assets/cbb-big-east-1980s/butler.png?v=20261114-bigeast-refresh2',
 '156':'assets/cbb-big-east-1980s/creighton.png?v=20261114-bigeast-refresh2',
 '305':'assets/cbb-big-east-1980s/depaul.png?v=20261114-bigeast-refresh2',
 '46':'assets/cbb-big-east-1980s/georgetown.png?v=20261114-bigeast-refresh2',
 '269':'assets/cbb-big-east-1980s/marquette.png?v=20261114-bigeast-refresh2',
 '2507':'assets/cbb-big-east-1980s/providence.png?v=20261114-bigeast-refresh2',
 '2550':'assets/cbb-big-east-1980s/seton-hall.png?v=20261114-bigeast-refresh2',
 '2599':'assets/cbb-big-east-1980s/st-johns.png?v=20261114-bigeast-refresh2',
 '41':'assets/cbb-big-east-1980s/uconn.png?v=20261114-bigeast-refresh2',
 '222':'assets/cbb-big-east-1980s/villanova.png?v=20261114-bigeast-refresh2',
 '2752':'assets/cbb-big-east-1980s/xavier.png?v=20261114-bigeast-refresh2'
});
const A10_HERITAGE=Object.freeze({
 '2244':'assets/cbb-atlantic-10-1980s/george-mason.png?v=source-optical-audit-20261115-2',
 '45':'assets/cbb-atlantic-10-1980s/george-washington.png?v=20261114-a10-refresh2',
 '2350':'assets/cbb-atlantic-10-1980s/loyola-chicago.png?v=normalized-source-20261115-1',
 '227':'assets/cbb-atlantic-10-1980s/rhode-island.png?v=normalized-source-20261115-1',
 '2184':'assets/cbb-atlantic-10-1980s/duquesne.png?v=a10-archive-20261114-1',
 '2325':'assets/cbb-atlantic-10-1980s/la-salle.png?v=a10-archive-20261114-1',
 '2603':'assets/cbb-atlantic-10-1980s/saint-joseph-s.png?v=a10-archive-20261114-1',
 '2670':'assets/cbb-atlantic-10-1980s/vcu.png?v=source-optical-audit-20261115-2',
 '2166':'assets/cbb-atlantic-10-1980s/davidson.png?v=a10-archive-20261114-1',
 '2168':'assets/cbb-atlantic-10-1980s/dayton.png?v=a10-archive-20261114-1',
 '2230':'assets/cbb-atlantic-10-1980s/fordham.png?v=source-optical-audit-20261115-2',
 '139':'assets/cbb-atlantic-10-1980s/saint-louis.png?v=a10-archive-20261114-1',
 '179':'assets/cbb-atlantic-10-1980s/st-bonaventure.png?v=a10-archive-20261114-3'
});
const MOUNTAIN_WEST_HERITAGE=Object.freeze({
 '167':'assets/cbb-mountain-west-1980s/new-mexico.png?v=source-optical-audit-20261115-2',
 '2005':'assets/cbb-mountain-west-1980s/air-force.png?v=mountain-west-heritage-20261114-1',
 '2253':'assets/cbb-mountain-west-1980s/grand-canyon.png?v=mountain-west-heritage-20261114-1',
 '2440':'assets/cbb-mountain-west-1980s/nevada.png?v=mountain-west-heritage-20261114-1',
 '23':'assets/cbb-mountain-west-1980s/san-jose-state.png?v=source-optical-audit-20261115-2',
 '2638':'assets/cbb-mountain-west-1980s/utep.png?v=utep-basketball-20261114-2',
 '62':'assets/cbb-mountain-west-1980s/hawaii.png?v=mountain-west-heritage-20261114-1',
 '302':'assets/cbb-mountain-west-1980s/uc-davis.png?v=mountain-west-heritage-20261114-1',
 '2439':'assets/cbb-mountain-west-1980s/unlv.png?v=mountain-west-heritage-20261114-1',
 '2751':'assets/cbb-mountain-west-1980s/wyoming.png?v=mountain-west-heritage-20261114-1'
});
const ARCHIVE_HERITAGE=Object.freeze({
 '2739':'assets/cbb-retro-archive/2739.png?v=20261116-usf1',
 '5':'assets/cbb-retro-archive/5.png?v=20261116-usf1',
 '6':'assets/cbb-retro-archive/6.png?v=20261116-usf1',
 '9':'assets/cbb-retro-archive/9.png?v=20261116-usf1',
 '12':'assets/cbb-retro-archive/12.png?v=20261116-usf1',
 '13':'assets/cbb-retro-archive/13.png?v=20261116-usf1',
 '16':'assets/cbb-retro-archive/16.png?v=20261116-usf1',
 '21':'assets/cbb-retro-archive/21.png?v=20261116-usf1',
 '27':'assets/cbb-retro-archive/27.png?v=20261116-usf1',
 '28':'assets/cbb-retro-archive/28.png?v=20261116-usf1',
 '36':'assets/cbb-retro-archive/36.png?v=20261116-usf1',
 '38':'assets/cbb-retro-archive/38.png?v=20261116-usf1',
 '43':'assets/cbb-retro-archive/43.png?v=20261116-usf1',
 '44':'assets/cbb-retro-archive/44.png?v=20261116-usf1',
 '47':'assets/cbb-retro-archive/47.png?v=20261116-usf1',
 '48':'assets/cbb-retro-archive/48.png?v=20261116-usf1',
 '50':'assets/cbb-retro-archive/50.png?v=20261116-usf1',
 '55':'assets/cbb-retro-archive/55.png?v=20261116-usf1',
 '56':'assets/cbb-retro-archive/56.png?v=20261116-usf1',
 '58':'assets/cbb-retro-archive/58.png?v=20261116-usf1',
 '66':'assets/cbb-retro-archive/66.png?v=20261116-usf1',
 '68':'assets/cbb-retro-archive/68.png?v=20261116-usf1',
 '70':'assets/cbb-retro-archive/70.png?v=20261116-usf1',
 '71':'assets/cbb-retro-archive/71.png?v=20261116-usf1',
 '79':'assets/cbb-retro-archive/79.png?v=20261116-usf1',
 '82':'assets/cbb-retro-archive/82.png?v=20261116-usf1',
 '85':'assets/cbb-retro-archive/85.png?v=20261116-usf1',
 '88':'assets/cbb-retro-archive/88.png?v=20261116-usf1',
 '91':'assets/cbb-retro-archive/91.png?v=20261116-usf1',
 '93':'assets/cbb-retro-archive/93.png?v=20261116-usf1',
 '94':'assets/cbb-retro-archive/94.png?v=20261116-usf1',
 '98':'assets/cbb-retro-archive/98.png?v=20261116-usf1',
 '104':'assets/cbb-retro-archive/104.png?v=20261116-usf1',
 '107':'assets/cbb-retro-archive/107.png?v=20261116-usf1',
 '108':'assets/cbb-retro-archive/108.png?v=20261116-usf1',
 '111':'assets/cbb-retro-archive/111.png?v=20261116-usf1',
 '113':'assets/cbb-retro-archive/113.png?v=20261116-usf1',
 '116':'assets/cbb-retro-archive/116.png?v=20261116-usf1',
 '119':'assets/cbb-retro-archive/119.png?v=20261116-usf1',
 '140':'assets/cbb-retro-archive/140.png?v=20261116-usf1',
 '147':'assets/cbb-retro-archive/147.png?v=20261116-usf1',
 '149':'assets/cbb-retro-archive/149.png?v=20261116-usf1',
 '151':'assets/cbb-retro-archive/151.png?v=20261116-usf1',
 '155':'assets/cbb-retro-archive/155.png?v=20261116-usf1',
 '159':'assets/cbb-retro-archive/159.png?v=20261116-usf1',
 '160':'assets/cbb-retro-archive/160.png?v=20261116-usf1',
 '161':'assets/cbb-retro-archive/161.png?v=20261116-usf1',
 '163':'assets/cbb-retro-archive/163.png?v=20261116-usf1',
 '166':'assets/cbb-retro-archive/166.png?v=20261116-usf1',
 '171':'assets/cbb-retro-archive/171.png?v=20261116-usf1',
 '172':'assets/cbb-retro-archive/172.png?v=20261116-usf1',
 '189':'assets/cbb-retro-archive/189.png?v=20261116-usf1',
 '193':'assets/cbb-retro-archive/193.png?v=20261116-usf1',
 '195':'assets/cbb-retro-archive/195.png?v=20261116-usf1',
 '197':'assets/cbb-retro-archive/197.png?v=20261116-usf1',
 '198':'assets/cbb-retro-archive/198.png?v=20261116-usf1',
 '202':'assets/cbb-retro-archive/202.png?v=20261116-usf1',
 '204':'assets/cbb-retro-archive/204.png?v=20261116-usf1',
 '218':'assets/cbb-retro-archive/218.png?v=20261116-usf1',
 '219':'assets/cbb-retro-archive/219.png?v=20261116-usf1',
 '225':'assets/cbb-retro-archive/225.png?v=20261116-usf1',
 '231':'assets/cbb-retro-archive/231.png?v=20261116-usf1',
 '232':'assets/cbb-retro-archive/232.png?v=20261116-usf1',
 '233':'assets/cbb-retro-archive/233.png?v=20261116-usf1',
 '235':'assets/cbb-retro-archive/235.png?v=20261116-usf1',
 '236':'assets/cbb-retro-archive/236.png?v=20261116-usf1',
 '239':'assets/cbb-retro-archive/239.png?v=20261116-usf1',
 '242':'assets/cbb-retro-archive/242.png?v=20261116-usf1',
 '248':'assets/cbb-retro-archive/248.png?v=20261116-usf1',
 '249':'assets/cbb-retro-archive/249.png?v=20261116-usf1',
 '250':'assets/cbb-retro-archive/250.png?v=20261116-usf1',
 '252':'assets/cbb-retro-archive/252.png?v=20261116-usf1',
 '253':'assets/cbb-retro-archive/253.png?v=20261116-usf1',
 '254':'assets/cbb-retro-archive/254.png?v=20261116-usf1',
 '256':'assets/cbb-retro-archive/256.png?v=20261116-usf1',
 '257':'assets/cbb-retro-archive/257.png?v=20261116-usf1',
 '261':'assets/cbb-retro-archive/261.png?v=20261116-usf1',
 '265':'assets/cbb-retro-archive/265.png?v=20261116-usf1',
 '270':'assets/cbb-retro-archive/270.png?v=20261116-usf1',
 '276':'assets/cbb-retro-archive/276.png?v=20261116-usf1',
 '277':'assets/cbb-retro-archive/277.png?v=20261116-usf1',
 '278':'assets/cbb-retro-archive/278.png?v=20261116-usf1',
 '279':'assets/cbb-retro-archive/279.png?v=20261116-usf1',
 '282':'assets/cbb-retro-archive/282.png?v=20261116-usf1',
 '284':'assets/cbb-retro-archive/284.png?v=20261116-usf1',
 '288':'assets/cbb-retro-archive/288.png?v=20261116-usf1',
 '290':'assets/cbb-retro-archive/290.png?v=20261116-usf1',
 '292':'assets/cbb-retro-archive/292.png?v=20261116-usf1',
 '294':'assets/cbb-retro-archive/294.png?v=20261116-usf1',
 '295':'assets/cbb-retro-archive/295.png?v=20261116-usf1',
 '299':'assets/cbb-retro-archive/299.png?v=20261116-usf1',
 '300':'assets/cbb-retro-archive/300.png?v=20261116-usf1',
 '301':'assets/cbb-retro-archive/301.png?v=20261116-usf1',
 '304':'assets/cbb-retro-archive/304.png?v=20261116-usf1',
 '309':'assets/cbb-retro-archive/309.png?v=20261116-usf1',
 '311':'assets/cbb-retro-archive/311.png?v=20261116-usf1',
 '314':'assets/cbb-retro-archive/314.png?v=20261116-usf1',
 '322':'assets/cbb-retro-archive/322.png?v=20261116-usf1',
 '324':'assets/cbb-retro-archive/324.png?v=20261116-usf1',
 '325':'assets/cbb-retro-archive/325.png?v=20261116-usf1',
 '326':'assets/cbb-retro-archive/326.png?v=20261116-usf1',
 '328':'assets/cbb-retro-archive/328.png?v=20261116-usf1',
 '331':'assets/cbb-retro-archive/331.png?v=20261116-usf1',
 '338':'assets/cbb-retro-archive/338.png?v=20261116-usf1',
 '339':'assets/cbb-retro-archive/339.png?v=20261116-usf1',
 '349':'assets/cbb-retro-archive/349.png?v=20261116-usf1',
 '350':'assets/cbb-retro-archive/350.png?v=20261116-usf1',
 '357':'assets/cbb-retro-archive/357.png?v=20261116-usf1',
 '399':'assets/cbb-retro-archive/399.png?v=20261116-usf1',
 '526':'assets/cbb-retro-archive/526.png?v=20261116-usf1',
 '2000':'assets/cbb-retro-archive/2000.png?v=20261116-usf1',
 '2006':'assets/cbb-retro-archive/2006.png?v=20261116-usf1',
 '2010':'assets/cbb-retro-archive/2010.png?v=20261116-usf1',
 '2011':'assets/cbb-retro-archive/2011.png?v=20261116-usf1',
 '2016':'assets/cbb-retro-archive/2016.png?v=20261116-usf1',
 '2026':'assets/cbb-retro-archive/2026.png?v=20261116-usf1',
 '2029':'assets/cbb-retro-archive/2029.png?v=20261116-usf1',
 '2031':'assets/cbb-retro-archive/2031.png?v=20261116-usf1',
 '2032':'assets/cbb-retro-archive/2032.png?v=20261116-usf1',
 '2046':'assets/cbb-retro-archive/2046.png?v=20261116-usf1',
 '2050':'assets/cbb-retro-archive/2050.png?v=20261116-usf1',
 '2057':'assets/cbb-retro-archive/2057.png?v=20261116-usf1',
 '2065':'assets/cbb-retro-archive/2065.png?v=20261116-usf1',
 '2066':'assets/cbb-retro-archive/2066.png?v=20261116-usf1',
 '2083':'assets/cbb-retro-archive/2083.png?v=20261116-usf1',
 '2084':'assets/cbb-retro-archive/2084.png?v=20261116-usf1',
 '2097':'assets/cbb-retro-archive/2097.png?v=20261116-usf1',
 '2099':'assets/cbb-retro-archive/2099.png?v=20261116-usf1',
 '2110':'assets/cbb-retro-archive/2110.png?v=20261116-usf1',
 '2115':'assets/cbb-retro-archive/2115.png?v=20261116-usf1',
 '2116':'assets/cbb-retro-archive/2116.png?v=20261116-usf1',
 '2117':'assets/cbb-retro-archive/2117.png?v=20261116-usf1',
 '2127':'assets/cbb-retro-archive/2127.png?v=20261116-usf1',
 '2130':'assets/cbb-retro-archive/2130.png?v=20261116-usf1',
 '2132':'assets/cbb-retro-archive/2132.png?v=20261116-usf1',
 '2142':'assets/cbb-retro-archive/2142.png?v=20261116-usf1',
 '2154':'assets/cbb-retro-archive/2154.png?v=20261116-usf1',
 '2169':'assets/cbb-retro-archive/2169.png?v=20261116-usf1',
 '2172':'assets/cbb-retro-archive/2172.png?v=20261116-usf1',
 '2174':'assets/cbb-retro-archive/2174.png?v=20261116-usf1',
 '2181':'assets/cbb-retro-archive/2181.png?v=20261116-usf1',
 '2182':'assets/cbb-retro-archive/2182.png?v=20261116-usf1',
 '2193':'assets/cbb-retro-archive/2193.png?v=20261116-usf1',
 '2197':'assets/cbb-retro-archive/2197.png?v=20261116-usf1',
 '2198':'assets/cbb-retro-archive/2198.png?v=20261116-usf1',
 '2199':'assets/cbb-retro-archive/2199.png?v=20261116-usf1',
 '2210':'assets/cbb-retro-archive/2210.png?v=20261116-usf1',
 '2217':'assets/cbb-retro-archive/2217.png?v=20261116-usf1',
 '2226':'assets/cbb-retro-archive/2226.png?v=20261116-usf1',
 '2229':'assets/cbb-retro-archive/2229.png?v=20261116-usf1',
 '2239':'assets/cbb-retro-archive/2239.png?v=20261116-usf1',
 '2241':'assets/cbb-retro-archive/2241.png?v=20261116-usf1',
 '2247':'assets/cbb-retro-archive/2247.png?v=20261116-usf1',
 '2250':'assets/cbb-retro-archive/2250.png?v=20261116-usf1',
 '2261':'assets/cbb-retro-archive/2261.png?v=20261116-usf1',
 '2272':'assets/cbb-retro-archive/2272.png?v=20261116-usf1',
 '2275':'assets/cbb-retro-archive/2275.png?v=20261116-usf1',
 '2277':'assets/cbb-retro-archive/2277.png?v=20261116-usf1',
 '2287':'assets/cbb-retro-archive/2287.png?v=20261116-usf1',
 '2296':'assets/cbb-retro-archive/2296.png?v=20261116-usf1',
 '2305':'assets/cbb-retro-archive/2305.png?v=20261116-usf1',
 '2306':'assets/cbb-retro-archive/2306.png?v=20261116-usf1',
 '2309':'assets/cbb-retro-archive/2309.png?v=20261116-usf1',
 '2320':'assets/cbb-retro-archive/2320.png?v=20261116-usf1',
 '2329':'assets/cbb-retro-archive/2329.png?v=20261116-usf1',
 '2330':'assets/cbb-retro-archive/2330.png?v=20261116-usf1',
 '2335':'assets/cbb-retro-archive/2335.png?v=20261116-usf1',
 '2344':'assets/cbb-retro-archive/2344.png?v=20261116-usf1',
 '2348':'assets/cbb-retro-archive/2348.png?v=20261116-usf1',
 '2349':'assets/cbb-retro-archive/2349.png?v=20261116-usf1',
 '2351':'assets/cbb-retro-archive/2351.png?v=20261116-usf1',
 '2352':'assets/cbb-retro-archive/2352.png?v=20261116-usf1',
 '2363':'assets/cbb-retro-archive/2363.png?v=20261116-usf1',
 '2368':'assets/cbb-retro-archive/2368.png?v=20261116-usf1',
 '2377':'assets/cbb-retro-archive/2377.png?v=20261116-usf1',
 '2378':'assets/cbb-retro-archive/2378.png?v=20261116-usf1',
 '2379':'assets/cbb-retro-archive/2379.png?v=20261116-usf1',
 '2382':'assets/cbb-retro-archive/2382.png?v=20261116-usf1',
 '2385':'assets/cbb-retro-archive/2385.png?v=20261116-usf1',
 '2393':'assets/cbb-retro-archive/2393.png?v=20261116-usf1',
 '2400':'assets/cbb-retro-archive/2400.png?v=20261116-usf1',
 '2405':'assets/cbb-retro-archive/2405.png?v=20261116-usf1',
 '2413':'assets/cbb-retro-archive/2413.png?v=20261116-usf1',
 '2415':'assets/cbb-retro-archive/2415.png?v=20261116-usf1',
 '2426':'assets/cbb-retro-archive/2426.png?v=20261116-usf1',
 '2427':'assets/cbb-retro-archive/2427.png?v=20261116-usf1',
 '2428':'assets/cbb-retro-archive/2428.png?v=20261116-usf1',
 '2429':'assets/cbb-retro-archive/2429.png?v=20261116-usf1',
 '2430':'assets/cbb-retro-archive/2430.png?v=20261116-usf1',
 '2433':'assets/cbb-retro-archive/2433.png?v=20261116-usf1',
 '2437':'assets/cbb-retro-archive/2437.png?v=20261116-usf1',
 '2441':'assets/cbb-retro-archive/2441.png?v=20261116-usf1',
 '2443':'assets/cbb-retro-archive/2443.png?v=20261116-usf1',
 '2447':'assets/cbb-retro-archive/2447.png?v=20261116-usf1',
 '2448':'assets/cbb-retro-archive/2448.png?v=20261116-usf1',
 '2449':'assets/cbb-retro-archive/2449.png?v=20261116-usf1',
 '2450':'assets/cbb-retro-archive/2450.png?v=20261116-usf1',
 '2453':'assets/cbb-retro-archive/2453.png?v=20261116-usf1',
 '2454':'assets/cbb-retro-archive/2454.png?v=20261116-usf1',
 '2458':'assets/cbb-retro-archive/2458.png?v=20261116-usf1',
 '2459':'assets/cbb-retro-archive/2459.png?v=20261116-usf1',
 '2460':'assets/cbb-retro-archive/2460.png?v=20261116-usf1',
 '2463':'assets/cbb-retro-archive/2463.png?v=20261116-usf1',
 '2464':'assets/cbb-retro-archive/2464.png?v=20261116-usf1',
 '2466':'assets/cbb-retro-archive/2466.png?v=20261116-usf1',
 '2473':'assets/cbb-retro-archive/2473.png?v=20261116-usf1',
 '2492':'assets/cbb-retro-archive/2492.png?v=20261116-usf1',
 '2501':'assets/cbb-retro-archive/2501.png?v=20261116-usf1',
 '2502':'assets/cbb-retro-archive/2502.png?v=20261116-usf1',
 '2504':'assets/cbb-retro-archive/2504.png?v=20261116-usf1',
 '2506':'assets/cbb-retro-archive/2506.png?v=20261116-usf1',
 '2511':'assets/cbb-retro-archive/2511.png?v=20261116-usf1',
 '2514':'assets/cbb-retro-archive/2514.png?v=20261116-usf1',
 '2515':'assets/cbb-retro-archive/2515.png?v=20261116-usf1',
 '2520':'assets/cbb-retro-archive/2520.png?v=20261116-usf1',
 '2523':'assets/cbb-retro-archive/2523.png?v=20261116-usf1',
 '2529':'assets/cbb-retro-archive/2529.png?v=20261116-usf1',
 '2534':'assets/cbb-retro-archive/2534.png?v=20261116-usf1',
 '2535':'assets/cbb-retro-archive/2535.png?v=20261116-usf1',
 '2539':'assets/cbb-retro-archive/2539.png?v=20261116-usf1',
 '2540':'assets/cbb-retro-archive/2540.png?v=20261116-usf1',
 '2541':'assets/cbb-retro-archive/2541.png?v=20261116-usf1',
 '2545':'assets/cbb-retro-archive/2545.png?v=20261116-usf1',
 '2546':'assets/cbb-retro-archive/2546.png?v=20261116-usf1',
 '2561':'assets/cbb-retro-archive/2561.png?v=20261116-usf1',
 '2565':'assets/cbb-retro-archive/2565.png?v=20261116-usf1',
 '2569':'assets/cbb-retro-archive/2569.png?v=20261116-usf1',
 '2571':'assets/cbb-retro-archive/2571.png?v=20261116-usf1',
 '2572':'assets/cbb-retro-archive/2572.png?v=20261116-usf1',
 '2582':'assets/cbb-retro-archive/2582.png?v=20261116-usf1',
 '2608':'assets/cbb-retro-archive/2608.png?v=20261116-usf1',
 '2612':'assets/cbb-retro-archive/2612.png?v=20261116-usf1',
 '2617':'assets/cbb-retro-archive/2617.png?v=20261116-usf1',
 '2619':'assets/cbb-retro-archive/2619.png?v=20261116-usf1',
 '2623':'assets/cbb-retro-archive/2623.png?v=20261116-usf1',
 '2627':'assets/cbb-retro-archive/2627.png?v=20261116-usf1',
 '2628':'assets/cbb-retro-archive/2628.png?v=20261116-usf1',
 '2630':'assets/cbb-retro-archive/2630.png?v=20261116-usf1',
 '2634':'assets/cbb-retro-archive/2634.png?v=20261116-usf1',
 '2635':'assets/cbb-retro-archive/2635.png?v=20261116-usf1',
 '2636':'assets/cbb-retro-archive/2636.png?v=20261116-usf1',
 '2640':'assets/cbb-retro-archive/2640.png?v=20261116-usf1',
 '2641':'assets/cbb-retro-archive/2641.png?v=20261116-usf1',
 '2643':'assets/cbb-retro-archive/2643.png?v=20261116-usf1',
 '2649':'assets/cbb-retro-archive/2649.png?v=20261116-usf1',
 '2653':'assets/cbb-retro-archive/2653.png?v=20261116-usf1',
 '2655':'assets/cbb-retro-archive/2655.png?v=20261116-usf1',
 '2674':'assets/cbb-retro-archive/2674.png?v=20261116-usf1',
 '2678':'assets/cbb-retro-archive/2678.png?v=20261116-usf1',
 '2681':'assets/cbb-retro-archive/2681.png?v=20261116-usf1',
 '2692':'assets/cbb-retro-archive/2692.png?v=20261116-usf1',
 '2710':'assets/cbb-retro-archive/2710.png?v=20261116-usf1',
 '2711':'assets/cbb-retro-archive/2711.png?v=20261116-usf1',
 '2717':'assets/cbb-retro-archive/2717.png?v=20261116-usf1',
 '2724':'assets/cbb-retro-archive/2724.png?v=20261116-usf1',
 '2729':'assets/cbb-retro-archive/2729.png?v=20261116-usf1',
 '2737':'assets/cbb-retro-archive/2737.png?v=20261116-usf1',
 '2747':'assets/cbb-retro-archive/2747.png?v=20261116-usf1',
 '2750':'assets/cbb-retro-archive/2750.png?v=20261116-usf1',
 '2754':'assets/cbb-retro-archive/2754.png?v=20261116-usf1',
 '2755':'assets/cbb-retro-archive/2755.png?v=20261116-usf1',
 '2771':'assets/cbb-retro-archive/2771.png?v=20261116-usf1',
 '2803':'assets/cbb-retro-archive/2803.png?v=20261116-usf1',
 '2815':'assets/cbb-retro-archive/2815.png?v=20261116-usf1',
 '2837':'assets/cbb-retro-archive/2837.png?v=20261116-usf1',
 '2856':'assets/cbb-retro-archive/2856.png?v=20261116-usf1',
 '2870':'assets/cbb-retro-archive/2870.png?v=20261116-usf1',
 '2908':'assets/cbb-retro-archive/2908.png?v=20261116-usf1',
 '2916':'assets/cbb-retro-archive/2916.png?v=20261116-usf1',
 '2934':'assets/cbb-retro-archive/2934.png?v=20261116-usf1',
 '3084':'assets/cbb-retro-archive/3084.png?v=20261116-usf1',
 '3101':'assets/cbb-retro-archive/3101.png?v=20261116-usf1',
 '112358':'assets/cbb-retro-archive/112358.png?v=20261116-usf1'
});
// User-selected original-era 1968-69 FTU Citronaut full-body orange-and-astronaut mascot artwork.

const UCF_CITRONAUT='assets/ucf-citronaut-1968.webp';
const retroURLForESPN=id=>BIG_TEN_HERITAGE[String(id)]||ACC_HERITAGE[String(id)]||SEC_HERITAGE[String(id)]||BIG_EAST_HERITAGE[String(id)]||A10_HERITAGE[String(id)]||MOUNTAIN_WEST_HERITAGE[String(id)]||ARCHIVE_HERITAGE[String(id)]||'';

const safeURL=v=>{try{let u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}};
const byNcaa=new Map(),byName=new Map(),ambiguous=new Set(),outsideByName=new Map(),outsideAmbiguous=new Set();
let registry={},palette={},outside={},outsideLocal={};
const outsideAliases=t=>[t.school,t.feed_name,t.corrected_name,...(t.aliases||[])].filter(Boolean).map(norm);
// Independent NCAA and ESPN identifiers may name the same real university.
// Do not mark a school's name ambiguous when verified records describe the
// SAME identity. Prefer the numeric scoreboard key and keep both source IDs.
function sameOutsideSchool(a,b){
 const x=norm(a?.school),y=norm(b?.school);
 if(!x||!y)return false;
 if(x===y)return true;
 return (x.startsWith(y)||y.startsWith(x))&&
   safeURL(a?.logo_url)&&safeURL(a?.logo_url)===safeURL(b?.logo_url);
}
function registerOutside(id,entry){
 for(const key of outsideAliases(entry)){
  if(!key||outsideAmbiguous.has(key)||byName.has(key))continue;
  const prior=outsideByName.get(key);
  if(prior&&prior!==id){
   if(sameOutsideSchool(outside[prior],entry)){
    if(/^[0-9]+$/.test(id)&&!/^[0-9]+$/.test(prior))outsideByName.set(key,id);
   }else{outsideByName.delete(key);outsideAmbiguous.add(key);}
  }else outsideByName.set(key,id);
 }
}
function alias(n,id){let key=norm(n);if(!key||ambiguous.has(key))return;if(byName.has(key)&&byName.get(key)!==id){ambiguous.add(key);byName.delete(key)}else byName.set(key,id)}
const ready=(async()=>{
try{
const [reg,cross,colors,opponents,localCrests]=await Promise.all([
  ...['data/mbb-logo-registry.json','data/ncaam-2026-27-espn-team-crosswalk.json','data/dual-ring-team-palette.json?v=ncaa-two-rings-20261101b']
    .map(p=>fetch(p,{cache:'no-cache'}).then(x=>{if(!x.ok)throw Error(p+' '+x.status);return x.json()})),
  fetch('data/mbb-out-of-division-opponent-logos.json?v=verified-aliases-20261116',{cache:'no-cache'})
    .then(x=>x.ok?x.json():{teams:{}}).catch(()=>({teams:{}})),
  fetch('data/cbb-outside-local-crest-manifest.json?v=outside-local-20261118-kutztown',{cache:'no-cache'})
    .then(x=>x.ok?x.json():{teams:{}}).catch(()=>({teams:{}}))
]);
if(Object.keys(reg.teams||{}).length!==365||cross.teams?.length!==365)throw Error('Incomplete 365-team logo registry');
registry=reg.teams;palette=colors.mbb||{};outside=opponents?.teams||{};outsideLocal=localCrests?.teams||{};
if(Object.keys(palette).length!==365)throw Error('Incomplete 365-program MBB color palette');
for(let row of cross.teams){
const id=String(row.espn_id),found=registry[id];
if(!found||found.canonical_id!==row.id||String(found.espn_id)!==id)throw Error('Logo ID mismatch: '+row.name);
if(!['embedded_roundel','flat','unverified'].includes(found.artwork_type))throw Error('Missing explicit artwork type: '+row.name);
const color=palette[id];
if(!color||!/^#[0-9a-f]{6}$/i.test(color.primary)||!/^#[0-9a-f]{6}$/i.test(color.secondary)||color.primary===color.secondary)throw Error('Missing two distinct logo colors: '+row.name);
byNcaa.set(row.id,id);for(let name of [row.name,row.espn_name,found.school,found.display_name,found.provider_team_name])alias(name,id);
}
if(byNcaa.size!==365)throw Error('Incomplete NCAA crosswalk');
// Official schedule lists UT Chattanooga; this is the NCAA Division I Chattanooga Mocs.
alias('UT Chattanooga','236');
// Reviewed official-school labels that differ from the provider's directory names.
alias("University of Mississippi","145");
alias("Central Connecticut State University","2115");
alias("North Carolina A&T State University","2448");
alias("Bethune-Cookman University","2065");
alias("Texas-Arlington","250");
alias("Tennessee-Martin","2630");
alias("University of Tennessee at Martin","2630");
alias("University of Tennessee at Chattanooga","236");
// Exact identities from the 365-school crosswalk, reviewed against schedule labels.
alias("University of Southern Mississippi","2572");
alias("Southern Mississippi","2572");
alias("University of Nebraska at Omaha","2437");
alias("UMKC","140");
alias("Missouri-Kansas City","140");
alias("California State University at Fullerton","2239");
alias("University of North Carolina Wilmington","350");
alias("University of Illinois Chicago","82");
alias("Stephen F. Austin","2617");
alias("McNeese State","2377");
alias("McNeese State University","2377");
alias("San Jose State","23");
alias("Brigham Young","252");
alias("Arkansas State University","2032");
alias("Arkansas Little Rock","2031");
alias("University of California Santa Barbara","2540");
alias("Central Connecticut State","2115");
alias("North Carolina A&T State","2448");
alias("Texas A&M - Corpus Christi","357");
alias("Texas A&M-Corpus Christi","357");
alias("Univ. of Washington","264");
alias("Univ. of Seattle","2547");
alias("Florida International University","2229");
alias("Long Beach State University","299");
alias("Virginia Commonwealth University","2670");
alias("South Carolina State University","2569");
alias("SC State","2569");
alias("Ragin' Cajuns","309");
alias("University of North Carolina at Wilmington","350");
alias("University of California at Santa Barbara","2540");
alias("University of California, Santa Barbara","2540");
alias("California State University Fullerton","2239");
for(const [id,entry] of Object.entries(outside)){
 if(registry[id]||!safeURL(entry.logo_url)||!/^#[0-9a-f]{6}$/i.test(entry.primary||'')||
   !/^#[0-9a-f]{6}$/i.test(entry.secondary||'')||
   entry.primary.toLowerCase()===entry.secondary.toLowerCase())continue;
 registerOutside(id,entry);
}
return true;
}catch(e){console.error('MBB logo registry:',e);return false}
})();
function render(options={}){
const name=String(options.name||'Team'),ncaa=String(options.ncaaId||''),given=String(options.espnId||'');
const resolved=byNcaa.get(ncaa)||'',byTitle=byName.get(norm(name))||'';
let id=resolved||given||byTitle;
// When a dated school calendar has a stale ESPN opponent ID, an unambiguous
// official crosswalk name takes priority. Never substitute a fuzzy match.
if(!ncaa&&byTitle&&given&&byTitle!==given)id=byTitle;
if((resolved&&given&&resolved!==given)||(ncaa&&registry[id]?.canonical_id!==ncaa))id='';
// For an explicitly named non-D-I opponent, the exact curated school identity
// takes precedence over a stale or reused Division I provider ID. Never infer
// a non-D-I identity from a numeric ESPN ID alone.
// Try exact aliases first; fixture feeds often append a mascot to the
// certified school name. Resolve such a suffix only when there is exactly
// one eligible outside-division school (never a fuzzy cross-school guess).
function outsideSchoolId(value){
 const key=norm(value);
 if(outsideByName.has(key))return outsideByName.get(key);
 if(byName.has(key)||key.length<8)return '';
 const matches=new Set();
 for(const [alias,id] of outsideByName){
  if(alias.length>=8&&key.startsWith(alias)&&key.length>alias.length)matches.add(id);
  // Allow shorter exact school labels when the catalog lists the full university
  // name or a mascot suffix. Only a unique school survives the ambiguity guard.
  if(key.length>=8&&alias.startsWith(key)&&alias.length>key.length)matches.add(id);
  if(matches.size>1)return '';
 }
 return matches.size===1?[...matches][0]:'';
}
const outsideNameId=!ncaa?outsideSchoolId(name):'';
const outsideNameEntry=outsideNameId?outside[outsideNameId]:null;
const outsideExact=!!outsideNameEntry&&outsideSchoolId(name)===outsideNameId;
// A supplied provider ID with a matching school alias retains THAT verified
// artwork, even if another provider has the same university under a different
// numeric or NCAA ID. A stale or mismatched ID is still rejected by name.
const directOutside=!ncaa&&!registry[id]&&!!outside[id]&&outsideAliases(outside[id]).includes(norm(name));
const known=(outsideExact||directOutside)?null:(registry[id]||null);
const outsideID=directOutside?id:outsideExact?outsideNameId:'';
const outsideEntry=outsideID&&outside[outsideID]&&(outsideSchoolId(name)===outsideID||outsideAliases(outside[outsideID]).includes(norm(name)))?outside[outsideID]:null;
// The exact-school locally baked asset wins over the transient external host.
const cachedEntry=outsideEntry?outsideLocal[outsideID]:null;
const cachedPath='assets/cbb-outside-crests/'+outsideID+'.png';
const cachedCrest=cachedEntry?.path===cachedPath&&norm(cachedEntry.school)===norm(outsideEntry.school||outsideEntry.corrected_name)?cachedPath:'';
const school=known,brand=known?palette[id]:outsideEntry;
const heritage=known?(id==='2116'?UCF_CITRONAUT:retroURLForESPN(id)):'';
// One exact, locally baked pixel asset for every verified current D-I identity.
// Ring color and optical fitting are compiled into the PNG, never patched
// per logo in a consumer page. All 365 men's and 363 women's IDs are covered.
const baked=known?'assets/cbb-embossed-crests/'+id+'.png?v=20261116-usf1':'';
const art=heritage?'flat':known?school.artwork_type:outsideEntry?'flat':'unverified';
const primary=(id==='2116'?UCF_CITRONAUT:'')||baked||heritage||(known?(school.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):''):
 outsideEntry?(cachedCrest||safeURL(outsideEntry.logo_url)):'');
// Keep verified modern artwork as the fallback whenever a vintage local asset fails.
// No other sport uses this renderer, and the badge retains its two-color ring.
const modern=known?(school.logo_url_verified?safeURL(school.official_logo_url||school.logo_url):''):'';
// Local heritage artwork must not silently switch to a modern third-party
// logo. If a selected local file is unavailable, fail visibly for audit.
const backup=id==='2116'?baked:baked||heritage?'':known?(school.provider_logo_candidates||[]).map(safeURL).find(x=>x&&x!==primary)||'':
 outsideEntry?(cachedCrest?safeURL(outsideEntry.logo_url):safeURL(outsideEntry.logo_alternate_url)||''):'';
// A watermark must use original school art, not a circular baked crest.
const watermarkArt=heritage||(known?modern:outsideEntry?safeURL(outsideEntry.logo_url):'');
const initials=name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
const kind=/^(small|score|power|schedule|hero|featured|history)$/.test(options.size||'')?options.size:'small';
const clr=brand?.primary||'#385866',alt=brand?.secondary||'#597582';
return '<span class="mbb-mark mbb-mark--'+kind+' mbb-mark--art-'+art+(heritage?' mbb-mark--heritage':'')+((baked||cachedCrest)&&id!=='2116'?' mbb-mark--precomposed':'')+(primary?'':' mbb-mark--missing')+'" style="--mbb-primary:'+esc(clr)+';--mbb-secondary:'+esc(alt)+'" data-espn-id="'+esc(known?id:(outsideEntry?outsideID:''))+'" data-artwork="'+esc(art)+'" data-watermark-art="'+esc(watermarkArt)+'" data-ring-count="2" role="img" aria-label="'+esc(name)+' logo"><span class="mbb-mark__initials" aria-hidden="true">'+esc(initials)+'</span>'+(primary?'<img class="mbb-mark__img"'+' src="'+esc(primary)+'" data-logo-alternate="'+esc(backup)+'" loading="lazy" decoding="async" alt="" onerror="window.MBBLogos.fail(this)">':'')+'</span>';
}
function fail(img){
if(!(img instanceof HTMLImageElement))return;
const alt=safeURL(img.dataset.logoAlternate);
if(alt&&img.src!==alt){img.dataset.logoAlternate='';img.style.removeProperty('filter');img.src=alt;return;}
img.closest('.mbb-mark')?.classList.add('mbb-mark--missing');img.remove();
}
// Repair wrappers left by an older cached publisher decorator. The marker
// prevents that old script from wrapping the same artwork a second time.
function stripLegacyRings(root=document){
 const badges=new Set();
 if(root.matches?.('.mbb-mark'))badges.add(root);
 const owner=root.closest?.('.mbb-mark');if(owner)badges.add(owner);
 root.querySelectorAll?.('.mbb-mark').forEach(b=>badges.add(b));
 for(const badge of badges){
  badge.classList.remove('slt-dual-shell');
  for(const wrapper of badge.querySelectorAll('.slt-mark')){
   const img=wrapper.querySelector('img.mbb-mark__img');
   if(img){img.dataset.sltMarkState='1';wrapper.replaceWith(img);}
  }
  for(const img of badge.querySelectorAll('img.mbb-mark__img')){
   img.classList.remove('slt-dual-image');
   for(const prop of ['border','outline','box-shadow','padding','border-radius','background'])img.style.removeProperty(prop);
  }
 }
}
function upgradeLegacyCalendar(){
for(let node of document.querySelectorAll('#mbb-calendar-host .sched-logo:not(.mbb-mark)')){
const src=node.querySelector('img')?.getAttribute('src')||'';
const id=src.match(/\/ncaa\/(?:500|500-dark)\/(\d+)\.png/i)?.[1]||'';
const name=node.closest('.sched-matchup')?.querySelector('.sched-opponent strong')?.textContent||'Team';
const temp=document.createElement('div');temp.innerHTML=render({espnId:id,name,size:'schedule'});node.replaceWith(temp.firstElementChild);
}
}
// Third-party legacy views sometimes output a bare ESPN PNG. Upgrade it exactly
// once into the same MBB badge; never wrap the badge a second time.
function upgradeBareLogos(root=document){
 const list=[];
 if(root.tagName==='IMG')list.push(root);
 root.querySelectorAll?.('img[src*="/teamlogos/ncaa/"]').forEach(img=>list.push(img));
 for(const img of list){
  if(!img.isConnected||img.closest('.mbb-mark,.ledger26-ghost')||img.matches('.player-photo,.player-portrait,.mbb-player-photo')||img.closest('.player-photo,.player-portrait,.mbb-player-image-wrap'))continue;
  const id=(img.getAttribute('src')||'').match(/\/ncaa\/(?:500|500-dark)\/(\d+)\.(?:png|webp)/i)?.[1];
  if(!id||!registry[id])continue;
  const temp=document.createElement('span');temp.innerHTML=render({espnId:id,name:registry[id].school,size:'small'});
  img.replaceWith(temp.firstElementChild);
 }
}
w.MBBLogos={ready,render,byNCAA:(id,size,name)=>render({ncaaId:id,name,size}),byESPN:(id,size,name)=>render({espnId:id&& (registry[String(id)]||outside[String(id)])?String(id):'',name:name||registry[String(id)]?.school||outside[String(id)]?.corrected_name||outside[String(id)]?.school,size}),byName:(name,size)=>render({name,size}),fail,stripLegacyRings,upgradeLegacyCalendar,upgradeBareLogos,logoURL:id=>{const eid=byNcaa.get(id)||String(id);return eid==='2116'?UCF_CITRONAUT:registry[eid]?'assets/cbb-embossed-crests/'+eid+'.png?v=20261116-usf1':retroURLForESPN(eid)||''},retroURLForESPN,heritageArchiveTeamIds:()=>Object.keys(ARCHIVE_HERITAGE),heritageTeamIds:()=>Object.keys(BIG_TEN_HERITAGE),heritageACCTeamIds:()=>Object.keys(ACC_HERITAGE),heritageSECTeamIds:()=>Object.keys(SEC_HERITAGE),heritageBigEastTeamIds:()=>Object.keys(BIG_EAST_HERITAGE),heritageMountainWestTeamIds:()=>Object.keys(MOUNTAIN_WEST_HERITAGE),heritageA10TeamIds:()=>Object.keys(A10_HERITAGE),colorForESPN:id=>palette[String(id)]?{...palette[String(id)]}:outside[String(id)]?{primary:outside[String(id)].primary,secondary:outside[String(id)].secondary}:null,schoolNameForESPN:id=>String(registry[String(id)]?.school||outside[String(id)]?.corrected_name||outside[String(id)]?.school||'').replace(/\bSt\.$/,'State')};
ready.then(ok=>{
 if(!ok)return;
 const run=()=>{stripLegacyRings(document);upgradeLegacyCalendar();upgradeBareLogos(document)};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 if(document.documentElement)new MutationObserver(changes=>{for(const change of changes)for(const node of change.addedNodes)if(node.nodeType===1){upgradeBareLogos(node);stripLegacyRings(node)}}).observe(document.documentElement,{subtree:true,childList:true});
});
})(window);

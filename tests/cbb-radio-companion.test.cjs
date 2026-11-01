/* Zero-recording, permission-gated radio companion for NCAA Gamefiles. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'cbb-radio-companion.js'),'utf8');
const css=fs.readFileSync(path.join(root,'cbb-radio-companion.css'),'utf8');
const html=fs.readFileSync(path.join(root,'cbb-gamefile.html'),'utf8');
const gamefile=fs.readFileSync(path.join(root,'cbb-live-center.js'),'utf8');
const companion=fs.readFileSync(path.join(root,'cbb-live-court.js'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(root,'data/cbb-radio-sources.json'),'utf8'));
assert.equal(config.schema_version,1);
assert.equal(config.sources.length,3);
assert(config.sources.every(x=>x.direct_audio_url===null&&x.cors_verified===false&&x.visualization_permission==='unverified'),
 'live waveform MUST remain disabled until broadcaster permission and CORS are verified');
assert(!source.includes('navigator.mediaDevices'),'radio may not access microphones or devices');
assert(!/\bgetUserMedia\s*\(/.test(source),'microphone capture is forbidden');
assert(!/\bnew\s+MediaRecorder\s*\(/.test(source),'radio recording is forbidden');
assert(!/\b(?:localStorage|sessionStorage|indexedDB)\b/.test(source),'audio analysis is not persisted');
assert(!/createMediaStreamDestination|new\s+Blob\s*\(/.test(source),'there is no media capture or export');
assert(source.includes('getByteTimeDomainData'),'waveform uses in-browser AnalyserNode samples');
assert(source.includes("document.createElement('audio')")&&source.includes("audio.crossOrigin='anonymous'"),
 'only user-selected, CORS-enabled media elements are analyzable');
assert(html.includes('cbb-radio-companion.js')&&html.includes('cbb-radio-companion.css'),
 'the actual Gamefile loads radio companion assets');
assert(gamefile.includes('id="cbb-radio-companion-root"')&&gamefile.includes('window.SLTRadio.mount('),
 'radio root is mounted outside frequently refreshed game statistics');
assert(companion.includes("(global.SLTRadio?'':stationLinks(g))"),'do not duplicate radio blocks');
assert(css.includes('slr-unavailable')&&css.includes('slr-analysis'),'rights-gated UI is distinct');
let radio;
const sandbox={window:{},URL,Date,Number,Array,String,Map,WeakMap,AbortController,Promise,console};
vm.runInNewContext(source,sandbox,{filename:'cbb-radio-companion.js'});
radio=sandbox.window.SLTRadio;
assert(radio&&typeof radio.mount==='function'&&typeof radio.isLicensed==='function');
const safe={
 id:'test-station',gender:'both',team_espn_ids:['87'],
 label:'Authorized test-only stream',listen_url:'https://example.test/listen',
 direct_audio_url:'https://example.test/audio.mp3',
 permission_evidence_url:'https://example.test/license',
 visualization_permission:'explicit',cors_verified:true,verified_until:'2099-12-31'
};
assert.equal(radio.isLicensed(safe),true,'all explicit license conditions can enable the player');
for(const bad of [
 {...safe,visualization_permission:'unverified'},
 {...safe,cors_verified:false},
 {...safe,direct_audio_url:null},
 {...safe,direct_audio_url:'http://example.test/audio.mp3'},
 {...safe,permission_evidence_url:null},
 {...safe,verified_until:'2020-01-01'},
 {...safe,direct_audio_url:'https://127.0.0.1/audio'},
 {...safe,direct_audio_url:'https://bob:pass@example.test/audio.mp3'}
])assert.equal(radio.isLicensed(bad),false,'reject noncompliant broadcasters');
const game={id:'401920982',away:{team:{id:'87'}},home:{team:{id:'222'}}};
const selected=radio.getGameSources(config.sources,game,'men');
assert(selected.some(x=>x.id==='nd-mbb-radio')&&selected.some(x=>x.id==='varsity-radio'));
assert(!selected.some(x=>x.id==='nd-wbb-radio'),'do not mix men's and women's radio feeds');
assert(radio.getGameSources(config.sources,game,'women').some(x=>x.id==='nd-wbb-radio'));
assert(!radio.getGameSources(config.sources,{away:{team:{id:'123'}},home:{team:{id:'456'}}},'men')
  .some(x=>x.id==='nd-mbb-radio'),'unrelated team cannot inherit Notre Dame audio');
console.log('PASS Radio Desk: broadcaster permission + CORS gated, zero microphone, no recording, no storage, correct college editions.');

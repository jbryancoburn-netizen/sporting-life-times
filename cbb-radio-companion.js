/* SL&T RADIO DESK: opt-in direct media visualization with zero capture or storage.
 * NO microphone APIs, MediaRecorder, audio upload, relay, stream scraping, or synthetic waveforms.
 * Only approved streams from a broadcaster may be played and analyzed.
 */
(function(global){
'use strict';
const sessions=new WeakMap();
let registry=null, pending=null;
const FALLBACK=[{id:'nd-fallback',label:'Notre Dame Radio Network',gender:'both',
  team_espn_ids:['87'],listen_url:'https://fightingirish.com/radioaffiliates'},
 {id:'varsity-fallback',label:'Find a broadcast at The Varsity Network',gender:'both',
  team_espn_ids:[],listen_url:'https://thevarsitynetwork.com/audioapplink'}];
function safeLink(url){
 try{const u=new URL(String(url));return u.protocol==='https:'?u.href:null;}catch{return null;}
}
function escapeText(x){return String(x??'').replace(/[&<>"']/g,v=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[v]));}
function isLicensed(source){
 // Both *documented permission* and browser-readable streaming are required.
 // HTTPS alone, or public listening, is insufficient.
 if(!source||source.visualization_permission!=='explicit'||
    source.cors_verified!==true||!safeLink(source.direct_audio_url)||
    !safeLink(source.permission_evidence_url))return false;
 const expiry=Date.parse(source.verified_until||'');
 if(!Number.isFinite(expiry)||expiry<Date.now())return false;
 const u=new URL(source.direct_audio_url);
 return !['localhost','127.0.0.1'].includes(u.hostname)&&
   !u.username&&!u.password&&!u.hash;
}
function getGameSources(entries,game,gender){
 const ids=new Set([String(game?.away?.team?.id||''),String(game?.home?.team?.id||'')]);
 return entries.filter(s=>{
  if(!safeLink(s.listen_url)||!['both',gender].includes(s.gender))return false;
  const teamIds=Array.isArray(s.team_espn_ids)?s.team_espn_ids.map(String):[];
  return !teamIds.length||teamIds.some(id=>ids.has(id));
 }).sort((a,b)=>Number(!a.team_espn_ids?.length)-Number(!b.team_espn_ids?.length)).slice(0,5);
}
async function sources(){
 if(registry)return registry;
 if(!pending){
  pending=(async()=>{
   try{
    const response=await fetch('data/cbb-radio-sources.json',{cache:'no-store',credentials:'omit'});
    if(!response.ok)throw Error('registry unavailable');
    const data=await response.json();
    if(data?.schema_version!==1||!Array.isArray(data.sources))throw Error('invalid registry');
    registry=data.sources;
   }catch{registry=FALLBACK;}
   return registry;
  })();
 }
 return pending;
}
function status(s,msg){
 if(!s.root?.isConnected)return;
 const el=s.root.querySelector('[data-radio-status]');
 if(el)el.textContent=msg;
}
function stopVisual(s){
 if(s.raf!=null){cancelAnimationFrame(s.raf);s.raf=null;}
 if(s.canvas){const ctx=s.canvas.getContext('2d');ctx?.clearRect(0,0,s.canvas.width,s.canvas.height);}
}
function draw(s){
 if(!s.root?.isConnected||document.hidden||!s.analyser||!s.canvas||s.audio.paused){
  stopVisual(s);return;
 }
 const canvas=s.canvas,context=canvas.getContext('2d');
 if(!context){stopVisual(s);return;}
 s.analyser.getByteTimeDomainData(s.wave);
 const w=canvas.width,h=canvas.height;
 context.clearRect(0,0,w,h);
 const style=getComputedStyle(canvas);
 const ink=style.getPropertyValue('--radio-ink').trim()||'#32616b';
 context.strokeStyle=ink;context.lineWidth=2;context.beginPath();
 const hop=Math.max(1,Math.floor(s.wave.length/w));
 for(let x=0;x<w;x++){
  const v=(s.wave[Math.min(s.wave.length-1,x*hop)]-128)/128;
  const y=h/2+v*h*.42;
  if(x===0)context.moveTo(x,y);else context.lineTo(x,y);
 }
 context.stroke();
 s.raf=requestAnimationFrame(()=>draw(s));
}
async function start(s,source){
 if(!isLicensed(source))return;
 if(s.audio){
  try{await s.audio.play();}catch{status(s,'The authorized audio stream could not start. Use the official listening link.');}
  return;
 }
 const AudioContext=global.AudioContext||global.webkitAudioContext;
 if(!AudioContext){status(s,'Audio visualization is unsupported in this browser. Use the official listening link.');return;}
 try{
  // Creating this media element on a user click avoids autoplay and does not
  // request microphone or screen access.
  const audio=document.createElement('audio');
  audio.crossOrigin='anonymous';audio.preload='none';audio.controls=true;
  audio.src=source.direct_audio_url;audio.setAttribute('aria-label','Authorized college radio stream');
  const mountPoint=s.root.querySelector('[data-radio-player]');
  mountPoint.appendChild(audio);
  const ctx=new AudioContext(),analyser=ctx.createAnalyser();
  analyser.fftSize=1024;analyser.smoothingTimeConstant=.65;
  const node=ctx.createMediaElementSource(audio);
  node.connect(analyser);
  analyser.connect(ctx.destination); // user hears the original broadcaster
  s.audio=audio;s.context=ctx;s.analyser=analyser;
  s.wave=new Uint8Array(analyser.frequencyBinCount);
  s.canvas=s.root.querySelector('canvas');
  audio.addEventListener('playing',()=>{
   status(s,'Authorized live stream playing. Waveform is processed locally and is not stored.');
   stopVisual(s);if(!document.hidden)draw(s);
  });
  audio.addEventListener('pause',()=>{stopVisual(s);status(s,'Audio paused. No waveform data retained.');});
  audio.addEventListener('ended',()=>{stopVisual(s);status(s,'Broadcast ended.');});
  audio.addEventListener('error',()=>{stopVisual(s);status(s,'Stream playback failed or browser access was denied. Use the official listening link.');});
  await ctx.resume();
  await audio.play();
 }catch{
  stopVisual(s);
  status(s,'The broadcaster’s stream is unavailable for visualization. Open the official player instead.');
 }
}
function close(s){
 stopVisual(s);
 try{s.audio?.pause();}catch{}
 if(s.audio){s.audio.removeAttribute('src');s.audio.load();s.audio.remove();}
 if(s.context){s.context.close().catch(()=>{});}
 s.audio=null;s.context=null;s.analyser=null;s.wave=null;s.canvas=null;
}
function markup(items,active){
 const direct=items.find(isLicensed);
 return '<section class="slr-desk" aria-label="College basketball radio companion">'+
 '<div class="slr-header"><div><span class="slr-eyebrow">GAMEFILE · OFFICIAL BROADCASTS</span>'+
 '<h2>Radio desk</h2></div><span class="slr-badge">'+(direct?'AUTHORIZED AUDIO':'LISTEN AT SOURCE')+'</span></div>'+
 '<p class="slr-note">Listen through the broadcaster’s official player. Our site never requests your microphone, records audio, or sends audio to our servers.</p>'+
 '<div class="slr-links">'+items.map(item=>'<a href="'+escapeText(safeLink(item.listen_url))+
 '" target="_blank" rel="noopener noreferrer">'+escapeText(item.label)+' ↗</a>').join('')+'</div>'+
 (direct?'<div class="slr-analysis"><button type="button" data-radio-start>'+
 'Play authorized stream &amp; visualize</button><div data-radio-player></div>'+
 '<canvas width="640" height="112" aria-label="Real-time waveform of authorized broadcast (not player or ball tracking)" role="img"></canvas></div>':
 '<p class="slr-unavailable">Audio-reactive mode is not enabled for this broadcast: the broadcaster has not provided a verified, analysis-permitted stream. The Gamefile’s sourced play-by-play remains available.</p>')+
 '<p class="slr-status" data-radio-status aria-live="polite">'+
 (direct?'Ready: choose Play to begin. Nothing starts automatically.':
 'No audio samples are accessed by The Sporting Life &amp; Times.')+'</p>'+
 '<small class="slr-credit">Audio stays with its broadcaster. Broadcast availability, georestrictions and tracking policies are set by that broadcaster. Our waveform never identifies game events.</small></section>';
}
async function mount(root,game,gender){
 if(!root||!game)return;
 const key=String(game.id||'')+'/'+String(gender);
 let s=sessions.get(root);
 if(s?.key===key)return; // NEVER interrupt a playing stream during 15s score refresh
 if(s)close(s);
 s={root,key,audio:null,context:null,analyser:null,canvas:null,wave:null,raf:null,source:null};
 sessions.set(root,s);
 root.innerHTML='<div class="slr-loading">Checking authorized radio sources…</div>';
 const all=await sources();
 if(sessions.get(root)!==s)return;
 const items=getGameSources(all,game,gender);
 const list=items.length?items:FALLBACK.filter(x=>!x.team_espn_ids.length);
 s.source=list.find(isLicensed)||null;
 root.innerHTML=markup(list,s.source);
 root.addEventListener('click',event=>{
  if(!event.target.closest('[data-radio-start]')||sessions.get(root)!==s||!s.source)return;
  start(s,s.source);
 },{signal:(s.abort=new AbortController()).signal});
}
function dispose(root){
 const s=sessions.get(root);if(!s)return;
 s.abort?.abort();close(s);sessions.delete(root);root.innerHTML='';
}
global.SLTRadio={mount,dispose,isLicensed,getGameSources};
})(window);
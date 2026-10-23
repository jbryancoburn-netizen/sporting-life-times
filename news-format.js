(function(root){'use strict';
const entities={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',hellip:'…',mdash:'—',ndash:'–'};
function decode(input){
 let s=String(input??'');
 for(let i=0;i<3;i++)s=s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(matched,key)=>{
 if(key[0]==='#'){const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):matched;}
 return entities[key.toLowerCase()]??matched;
 });
 return s.replace(/[\u00a0\u200b\ufeff]/g,' ').replace(/\s+/g,' ').trim();
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clean(input,limit=250){
 let s=decode(input).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 if(s.length>limit){let cut=s.lastIndexOf(' ',limit);if(cut<limit-35)cut=limit;s=s.slice(0,cut).trimEnd()+'…';}
 return s;
}
function time(input){
 const d=new Date(input||'');if(!Number.isFinite(d.getTime()))return 'Time unavailable';
 return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(d)+' ET';
}
const meta=a=>escape(clean(a.source||'Publisher',75))+' · '+escape(time(a.published_at));
const title=a=>escape(clean(a.title||'Untitled story',220));
const summary=a=>escape(clean(a.summary||'',240));
root.SportingNewsFormat=Object.freeze({decode,escape,clean,time,meta,title,summary});
})(typeof window!=='undefined'?window:globalThis);

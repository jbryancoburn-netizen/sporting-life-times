(()=>{'use strict';
const opened=new Date();
const formatter=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZoneName:'short'});
function install(){
 if(document.getElementById('slt-access-clock'))return;
 const el=document.createElement('div');el.id='slt-access-clock';el.setAttribute('role','status');
 el.setAttribute('aria-label','Newspaper access and current Eastern time');
 el.style.cssText='box-sizing:border-box;width:100%;padding:5px 16px;text-align:center;background:#f3f0e9;color:#34322e;border-bottom:1px solid #c6c0b5;font:11px/1.5 Arial,Helvetica,sans-serif;letter-spacing:.025em;position:relative;z-index:2;';
 const first=document.body.firstElementChild;document.body.insertBefore(el,first);
 const safe=document.createElement('span');
 const current=document.createElement('span');
 safe.textContent='PAGE OPENED '+formatter.format(opened);
 current.style.marginLeft='14px';current.style.whiteSpace='nowrap';
 el.append(safe,current);
 function tick(){current.textContent='CURRENT '+formatter.format(new Date());}
 tick();setInterval(tick,30000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

/* The Sporting Life & Times: paged digital edition. No-JS fallback stays readable. */
(function(){
  'use strict';
  const editions=[
    {title:'Front Page',ids:['front-page']},
    {title:'The Scoreboard',ids:['scores']},
    {title:'The Rabby 20',ids:['rabby-front','team-desk']},
    {title:'Sporting Wire',ids:['wire']},
    {title:'Team Directory',ids:['coburn-20']},
    {title:'College Athletics',ids:['college-schedules']},
    {title:'Ratings & Predictions',ids:['sports-home']},
    {title:'Print Archive',ids:['archive']},
    {title:'About the Newspaper',ids:['standards']}
  ];
  function start(){
    const main=document.querySelector('main');
    const index=main&&main.querySelector('.edition-index');
    if(!index)return;
    const pages=editions.map(e=>({title:e.title,nodes:e.ids.map(id=>document.getElementById(id)).filter(Boolean)}));
    const control=document.createElement('nav');
    control.className='edition-pagination';
    control.setAttribute('aria-label','Newspaper pages');
    control.innerHTML='<button type="button" class="edition-prev" aria-label="Previous newspaper page">← Previous</button><span class="edition-position" aria-live="polite"></span><button type="button" class="edition-next" aria-label="Next newspaper page">Next →</button>';
    index.insertAdjacentElement('afterend',control);
    const bottom=control.cloneNode(true);
    bottom.classList.add('edition-pagination-bottom');
    const last=pages.flatMap(p=>p.nodes).at(-1);
    if(last)last.insertAdjacentElement('afterend',bottom);
    const controls=[control,bottom];
    let current=0;
    let turnTimer=null;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    function pageForHash(){
      const hash=decodeURIComponent(location.hash.slice(1));
      if(!hash)return -1;
      return pages.findIndex(p=>p.nodes.some(n=>n.id===hash||n.contains(document.getElementById(hash))));
    }
    function show(n,updateHash){
      const previous=current;
      current=Math.max(0,Math.min(pages.length-1,n));
      pages.forEach((p,i)=>p.nodes.forEach(node=>{node.hidden=i!==current;}));
      if(turnTimer)clearTimeout(turnTimer);
      main.classList.remove('edition-turn-forward','edition-turn-back');
      if(previous!==current&&!reducedMotion.matches){
        void main.offsetWidth;
        main.classList.add(current>previous?'edition-turn-forward':'edition-turn-back');
        turnTimer=setTimeout(()=>main.classList.remove('edition-turn-forward','edition-turn-back'),560);
      }
      controls.forEach(nav=>{
        nav.querySelector('.edition-prev').disabled=current===0;
        nav.querySelector('.edition-next').disabled=current===pages.length-1;
        nav.querySelector('.edition-position').textContent=pages[current].title+' · Page '+(current+1)+' of '+pages.length;
      });
      document.querySelectorAll('.edition-index a[href^="#"]').forEach(a=>{
        const target=document.getElementById(a.hash.slice(1));
        const active=target&&pages[current].nodes.some(n=>n===target||n.contains(target));
        if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
      });
      if(updateHash){
        history.replaceState(null,'','#page-'+(current+1));
        window.scrollTo({top:0,behavior:'auto'});
      }
    }
    controls.forEach(nav=>{
      nav.querySelector('.edition-prev').addEventListener('click',()=>show(current-1,true));
      nav.querySelector('.edition-next').addEventListener('click',()=>show(current+1,true));
    });
    document.addEventListener('click',e=>{
      const a=e.target.closest('a[href^="#"]');
      if(!a)return;
      const id=a.getAttribute('href').slice(1);
      if(!id)return;
      const target=document.getElementById(id);
      const page=pages.findIndex(p=>p.nodes.some(n=>n===target||(target&&n.contains(target))));
      if(page<0)return;
      if(page!==current)show(page,false);
      // Allow browser to focus/scroll to the target after revealing its page.
    });
    window.addEventListener('hashchange',()=>{
      const m=location.hash.match(/^#page-(\d+)$/);
      if(m){show(Number(m[1])-1,false);return;}
      const n=pageForHash();
      if(n>=0)show(n,false);
    });
    document.addEventListener('keydown',e=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||e.defaultPrevented)return;
      const el=e.target;
      if(el.closest('input,textarea,select,button,[contenteditable="true"]'))return;
      if(e.key==='ArrowRight'&&current<pages.length-1){e.preventDefault();show(current+1,true);}
      if(e.key==='ArrowLeft'&&current>0){e.preventDefault();show(current-1,true);}
    });
    const m=location.hash.match(/^#page-(\d+)$/);
    const target=m?Number(m[1])-1:pageForHash();
    show(target>=0?target:0,false);
    document.documentElement.classList.add('paged-edition');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();

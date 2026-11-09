/* Shared mobile Sections control for Sporting Life & Times newspapers. */
(()=>{'use strict';
  const mobileQuery=window.matchMedia('(max-width: 700px)');
  function install(){
    if(document.querySelector('[data-slt-sections-toggle]'))return;
    const navs=Array.from(document.querySelectorAll('nav')).filter(nav=>
      !nav.closest('footer, dialog, aside') &&
      !nav.matches('.cbb-universal-nav, .cbb-mobile-enhanced') &&
      nav.querySelectorAll('a[href]').length>=3
    );
    navs.sort((a,b)=>Number(!!b.closest('header'))-Number(!!a.closest('header')));
    let nav=navs[0];
    if(!nav){
      // Some individual gamefiles omit the normal newspaper navigation.
      // Supply the same edition links on mobile without changing their desktop layout.
      const file=location.pathname.split('/').pop().toLowerCase();
      const nba=[['NBA Edition','nba.html'],['NBA Cup','nba-cup.html'],['Standings','nba-standings.html'],['Conferences','nba-conference.html?conference=East'],['Playoff Picture','nba-playoffs.html'],['RETRO Rankings','nba-rankings.html'],['Player Leaders','nba-players.html'],['Matchup Lab','nba-matchups.html'],['Game Center','nba-game-center.html'],['Find Your Team','nba.html#teams'],['All Sports','sports.html']];
      const cbb=[['The Hardwood Chronicle','ncaam.html'],['Daily Ledger','ncaam-slate.html'],['Conferences','ncaam-conference.html'],['RETRO Rankings','ncaam-elo.html'],['Player Leaders','ncaam-players.html'],['All Sports','sports.html']];
      const links=/^nba-/.test(file)?nba:/^(ncaam-|ncaaw-|cbb-)/.test(file)?cbb:null;
      if(!links)return;
      nav=document.createElement('nav');
      nav.className='slt-sections-generated';
      nav.setAttribute('aria-label','Newspaper navigation');
      for(const [title,url] of links){
        const link=document.createElement('a');
        link.href=url;link.textContent=title;nav.append(link);
      }
      nav.style.display='none';
      const mast=document.querySelector('header');
      if(mast)mast.append(nav);
      else document.body.prepend(nav);
    }
    if(!nav.id)nav.id='slt-sections-navigation';
    const toolbar=document.createElement('div');
    toolbar.className='slt-sections-toolbar';
    const button=document.createElement('button');
    button.type='button';
    button.className='slt-sections-button';
    button.dataset.sltSectionsToggle='';
    button.setAttribute('aria-controls',nav.id);
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label','Show newspaper sections');
    button.innerHTML='<span class="slt-sections-icon" aria-hidden="true">☰</span><span>Sections</span><span class="slt-sections-chevron" aria-hidden="true">⌄</span>';
    toolbar.append(button);
    nav.before(toolbar);
    nav.classList.add('slt-sections-collapsible');
    function setOpen(open){
      const visible=Boolean(open&&mobileQuery.matches);
      nav.classList.toggle('slt-sections-open',visible);
      button.setAttribute('aria-expanded',String(visible));
      button.setAttribute('aria-label',(visible?'Hide':'Show')+' newspaper sections');
    }
    button.addEventListener('click',()=>setOpen(!nav.classList.contains('slt-sections-open')));
    nav.addEventListener('click',event=>{
      if(event.target.closest('a[href]'))setOpen(false);
    });
    document.addEventListener('pointerdown',event=>{
      if(!nav.contains(event.target)&&!toolbar.contains(event.target))setOpen(false);
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&nav.classList.contains('slt-sections-open')){setOpen(false);button.focus();}
    });
    if(mobileQuery.addEventListener)mobileQuery.addEventListener('change',()=>setOpen(false));
    else mobileQuery.addListener(()=>setOpen(false));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
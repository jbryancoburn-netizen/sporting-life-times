(()=>{'use strict';
/* One NCAA soccer edition setting for the entire newspaper. */
const available=['men-d1','women-d1','men-d2','women-d2','men-d3','women-d3'];
const label=cohort=>(cohort.startsWith('women')?'WOMEN’S':'MEN’S')+' DIVISION '+({1:'I',2:'II',3:'III'}[cohort.slice(-1)]);
const params=new URLSearchParams(location.search);
let selected=available.includes(params.get('cohort'))?params.get('cohort'):'men-d1';
const buttons=[];
const updateVisuals=()=>{
 document.body.dataset.soccerCohort=selected;
 const [gender,division]=selected.split('-');
 for(const b of buttons){const active=b.dataset.value===(b.dataset.part==='gender'?gender:division);b.setAttribute('aria-pressed',String(active));b.classList.toggle('is-selected',active)}
 const display=document.getElementById('cs-edition-current');if(display)display.textContent=label(selected)+' · 2026 SEASON';
 const hero=document.querySelector('.cs-hero-copy>p');if(hero)hero.textContent='Conference championships, current verified results and independent USRS Elo for '+label(selected).toLowerCase()+'.';
 const eyebrow=document.querySelector('.cs-hero-eyebrow');if(eyebrow)eyebrow.firstChild.textContent='THE PITCH / '+label(selected)+' · 2026 NCAA SOCCER';
 const fieldLink=document.querySelector('.cs-hero-aside-foot a');if(fieldLink)fieldLink.hidden=selected!=='men-d1';
 const fieldText=document.querySelector('.cs-hero-aside-foot span');if(fieldText)fieldText.textContent=selected==='men-d1'?'48 IN THE FIELD · 23 AUTOMATIC BIDS':'2026 USRS · '+label(selected);
 const kicker=document.querySelector('.cs-hero-aside-kicker');if(kicker)kicker.textContent='THE TEAM TO BEAT · '+label(selected);
 const conferenceNav=document.querySelector('.cs-tournament-shortcut');if(conferenceNav){conferenceNav.hidden=false;conferenceNav.textContent=selected==='men-d1'?'CONFERENCE DESKS & TOURNAMENTS':'CONFERENCE DESKS';}
 for(const href of ['college-soccer-men.html','college-soccer-selection.html']){const nav=document.querySelector('nav.site-nav a[href="'+href+'"]');if(nav)nav.hidden=selected!=='men-d1';}
};
function set(next,opts={}){
 if(!available.includes(next))return;
 const changed=selected!==next;selected=next;
 if(opts.history!==false){const u=new URL(location.href);u.searchParams.set('cohort',selected);history.replaceState(history.state,'',u.pathname+u.search+u.hash)}
 updateVisuals();
 if(changed||opts.force)window.dispatchEvent(new CustomEvent('college-soccer:edition',{detail:{cohort:selected}}));
}
window.CollegeSoccerEdition={get:()=>selected,set,options:available.slice(),label};
const host=document.getElementById('cs-edition-bar');
if(host){
 host.classList.add('cs-edition-bar');
 const title=document.createElement('div');title.className='cs-edition-caption';
 const heading=document.createElement('strong');heading.textContent='SELECT YOUR SOCCER EDITION';
 const current=document.createElement('span');current.id='cs-edition-current';
 title.append(heading,current);host.append(title);
 const choices=document.createElement('div');choices.className='cs-edition-pickers';
 for(const [part,items] of [['gender',[['men','MEN'],['women','WOMEN']] ],['division',[['d1','D-I'],['d2','D-II'],['d3','D-III']]]]){
  const group=document.createElement('div');group.className='cs-edition-group';group.setAttribute('role','group');group.setAttribute('aria-label',part==='gender'?'Select men or women':'Select NCAA division');
  for(const [val,text] of items){const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.part=part;button.dataset.value=val;button.className='cs-edition-option';button.addEventListener('click',()=>{const [g,d]=selected.split('-');set(part==='gender'?val+'-'+d:g+'-'+val)});buttons.push(button);group.append(button)}
  choices.append(group);
 }
 host.append(choices);
}
window.addEventListener('popstate',()=>{const val=new URLSearchParams(location.search).get('cohort');set(available.includes(val)?val:'men-d1',{history:false});});
updateVisuals();
})();
/* Source-linked, sport-specific headlines. Never fabricate a story or score. */
(async function(){
  const blocks=[...document.querySelectorAll('.department-stories[data-department]')];
  if(!blocks.length)return;
  const patterns={
    'pro-basketball':/\b(nba|euroleague|nbl|basketball|pacers|lakers|celtics|knicks|nuggets|spurs|warriors)\b/i,
    'pro-hockey':/\b(nhl|echl|hockey|stanley cup|lightning|panthers|bruins|rangers|maple leafs|oilers)\b/i,
    'pro-football':/\b(nfl|cfl|chiefs|bears|packers|quarterback|touchdown|super bowl)\b/i,
    'college-football':/\b(college football|ncaa football|fbs|fcs|big ten football|cfp|college football playoff)\b/i,
    'college-basketball':/\b(college basketball|ncaa basketball|march madness|final four|men's basketball|women's basketball)\b/i,
    'other-college-sports':/\b(college hockey|college baseball|college softball|college soccer|college volleyball|ncaa hockey|ncaa baseball|ncaa softball|ncaa volleyball)\b/i
  };
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  try{
    const r=await fetch('articles.json',{cache:'no-store'});if(!r.ok)throw Error('Feed unavailable');
    const d=await r.json();const items=(Array.isArray(d.articles)?d.articles:[]).filter(a=>!(window.SportingEditorial?.isPromotion(a)??true));
    for(const el of blocks){
      const id=el.dataset.department;const matched=items.filter(a=>patterns[id].test([a.title,a.summary,a.category].join(' '))&&/^https:\/\//.test(a.url||'')).slice(0,5);
      el.innerHTML=matched.length?matched.map(a=>'<article class="department-story"><p class="meta">'+escape(a.source||'Publisher')+'</p><h4><a href="'+escape(a.url)+'" target="_blank" rel="noopener noreferrer">'+escape(a.title)+'</a></h4>'+(a.summary?'<p>'+escape(a.summary)+'</p>':'')+'</article>').join(''):'<p class="small">No verified stories currently available for this desk. Browse the Sporting Wire for more coverage.</p><p><a href="#wire">Sporting Wire →</a></p>';
    }
  }catch(e){blocks.forEach(el=>el.innerHTML='<p class="small">The news feed is temporarily unavailable.</p><p><a href="#wire">Sporting Wire →</a></p>');}
})();

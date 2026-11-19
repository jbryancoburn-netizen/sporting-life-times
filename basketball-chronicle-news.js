/* Layout for edition-specific headline feeds. Callers supply vetted story markup. */
(function(root){
 'use strict';
 function render(articles,story){
  if(!articles.length)return '';
  const first=story(articles[0],true);
  const supporting=articles.slice(1,4).map(article=>story(article,false)).join('');
  const remaining=articles.slice(4).map(article=>story(article,false)).join('');
  return '<div class="cbb-news-grid" data-count="'+(supporting?2:1)+'">'+first+
   (supporting?'<div class="chronicle-secondary">'+supporting+'</div>':'')+'</div>'+
   (remaining?'<details class="chronicle-more-reports"><summary>More headlines</summary>'+remaining+'</details>':'');
 }
 root.SLTChronicleNews={render};
})(typeof window!=='undefined'?window:globalThis);

#!/usr/bin/env node
/** One-time source HTML shape probe; never publishes schools or scores. */
const sources=[
 ['ncaa-men','https://web3.ncaa.org/directory/memberList?division=III&sportCode=MBB&type=12'],
 ['ncaa-women','https://web3.ncaa.org/directory/memberList?division=III&sportCode=WBB&type=12'],
 ['realgm-men','https://basketball.realgm.com/ncaa-diii/teams'],
 ['girlhoop-women','https://girlhoop.com/teams/'],
 ['readfield-men','https://readthefield.com/colleges/mens-basketball/division/d3']];
for(const [label,url] of sources){
 try{
  const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 (compatible; IndependentSportsDataAudit/1.0)','Accept':'text/html'},signal:AbortSignal.timeout(17000)});
  const html=await response.text();
  const sample=(p,n=450)=>{let i=html.toLowerCase().indexOf(p.toLowerCase());return i<0?'NOT FOUND':html.slice(Math.max(0,i-100),i+n).replace(/\s+/g,' ').slice(0,n);};
  console.log(JSON.stringify({label,scripts:[...html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)].map(x=>x[1]),hidden:[...html.matchAll(/<input[^>]*type=["']hidden["'][^>]*>/gi)].map(x=>x[0]).slice(0,15),inline:html.slice(-2200).replace(/\s+/g,' ').slice(0,1250),status:response.status,bytes:html.length,tr:(html.match(/<tr[\s>]/gi)||[]).length,
    td:(html.match(/<td[\s>]/gi)||[]).length,script:(html.match(/<script[\s>]/gi)||[]).length,
    head:html.slice(0,250).replace(/\s+/g,' '),
    trSample:sample('<tr',800),schools:sample('Adrian',460),division:sample('division',300),apollo:sample('__NEXT_DATA__',220)}));
 }catch(e){console.log(JSON.stringify({label,error:String(e)}))}
}

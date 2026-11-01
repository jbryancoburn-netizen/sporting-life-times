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

for(const [label,url] of [
 ['ncaa-js','https://web3.ncaa.org/directory/2e4c048/assets/js/memberList-page.js'],
 ['girlhoop-js','https://girlhoop.com/assets/data/teams-lower.js']]){
 try{
  const r=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(12000)});
  const body=await r.text();
  const matches=[...body.matchAll(/(?:url|type|method|ajax|fetch|endpoint)\s*[:=(]\s*['"]?([^'";\n]{3,160})/gi)]
    .slice(0,25).map(x=>x[0].slice(0,160));
  console.log(JSON.stringify({label,status:r.status,length:body.length,head:body.slice(0,2800),mid:body.slice(2800,4000),matches}));
 }catch(e){console.log(JSON.stringify({label,error:String(e)}))}
}

for(const [label,url] of [
 ['ncaa-common-js','https://web3.ncaa.org/directory/2e4c048/assets/js/ncaa-all-common.js'],
 ['ncaa-vendor-js','https://web3.ncaa.org/directory/2e4c048/assets/js/ncaa-vendor.js']]){
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(12000)}),body=await r.text();
  let matches=[...body.matchAll(/(?:getMemberListApiEndPoint|memberList|apiUrl|baseUrl|api\/directory)/gi)]
    .slice(0,35).map(x=>body.slice(Math.max(0,x.index-140),x.index+240));
  console.log(JSON.stringify({label,status:r.status,bytes:body.length,matches}));
 }catch(e){console.log(JSON.stringify({label,error:String(e)}))}
}

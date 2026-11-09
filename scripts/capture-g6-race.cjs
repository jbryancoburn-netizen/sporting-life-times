// Standalone archive capture. Runs only in the dedicated weekly G6 workflow.
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.goto('https://jbryancoburn-netizen.github.io/sporting-life-times/cfb-g6-playoff.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.CFB_G6_FIELD?.length===12&&window.CFB_G6_SIMULATION?.draws===2000,null,{timeout:90000});
  const result=await page.evaluate(()=>{
   const field=window.CFB_G6_FIELD,sim=window.CFB_G6_SIMULATION;
   const cards=[...document.querySelectorAll('#g6-field .seed-card')];
   return {stamp:document.querySelector('#data-stamp')?.textContent||'',teams:field.map((t,i)=>({
     id:String(t.id),name:cards[i]?.querySelector('.team-identity')?.textContent?.trim()||String(t.id),
     seed:i+1,conference:t.conference,automatic:!!t.automatic,rating:Math.round(t.rating),
     titlePct:Number((100*(sim.counts[String(t.id)]||0)/sim.draws).toFixed(1))
   }))};
  });
  if(result.teams.length!==12||new Set(result.teams.map(t=>t.id)).size!==12||result.teams.some(t=>!Number.isFinite(t.rating)||!Number.isFinite(t.titlePct)))throw Error('Invalid G6 capture');
  if(!/^Results: .* · Standings: .* ET/.test(result.stamp))throw Error('G6 source freshness stamp missing');
  const now=new Date(),date=now.toISOString().slice(0,10);
  const path='data/g6-race-history.json';
  let history={schema:1,snapshots:[]};
  if(fs.existsSync(path))history=JSON.parse(fs.readFileSync(path,'utf8'));
  if(!Array.isArray(history.snapshots))throw Error('Invalid G6 archive');
  if(history.snapshots.some(s=>s.date===date)){console.log('Edition already exists for '+date);return}
  history.snapshots.push({date,sourceStamp:result.stamp,teams:result.teams});
  history.snapshots.sort((a,b)=>a.date.localeCompare(b.date));
  fs.mkdirSync('data',{recursive:true});fs.writeFileSync(path,JSON.stringify(history,null,2)+'\n');
  console.log('Captured '+date+' with 12 qualified teams');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

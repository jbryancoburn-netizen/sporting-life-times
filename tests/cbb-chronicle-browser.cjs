'use strict';
/* Browser acceptance: actual local CSS, JS, source-backed feeds, archive images, two editions. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin=process.env.CHRONICLE_TEST_ORIGIN||'http://127.0.0.1:8765/';
async function main(){
 const browser=await chromium.launch({headless:true});
 const cases=[
  ['men','desktop',1366,900],['women','desktop',1366,900],
  ['men','mobile',390,844],['women','mobile',390,844],
  ['men','small-phone',320,760],['women','small-phone',320,760]
 ];
 const findings=[];
 try{
  for(const [gender,device,width,height] of cases){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
   const page=await context.newPage();
   const problems=[];
   try{
    await page.goto(origin+'ncaam.html?gender='+gender,{waitUntil:'domcontentloaded',timeout:25000});
    await page.locator('.cbb-front-edition .cbb-news-grid .cbb-news-story.lead').waitFor({timeout:16000});
    await page.locator('#chronicle-retro-panel .chronicle-retro-grid').waitFor({timeout:16000});
    await page.locator('.chronicle-archive').scrollIntoViewIfNeeded();
    await page.evaluate(async()=>{
      for(const image of document.querySelectorAll('.chronicle-crest img'))image.loading='eager';
      await Promise.all([...document.querySelectorAll('.chronicle-crest img')].map(x=>x.decode().catch(()=>null)));
    });
    await page.locator('.cbb-front-edition').scrollIntoViewIfNeeded();
    const props=await page.evaluate(()=>{
      const rect=x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}};
      const nav=document.querySelector('nav.chronicle-nav'),lead=document.querySelector('.cbb-news-story.lead');
      const index=document.querySelector('.slt-edition-index'),news=document.querySelector('.cbb-front-edition'),retro=document.getElementById('chronicle-retro');
      return {
        viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        navItems:[...nav.children].filter(x=>x.matches('a,.cbb-rank-menu,.chronicle-more')).length,
        navRect:rect(nav),newsRect:rect(news),leadRect:rect(lead),retroRect:rect(retro),indexRect:rect(index),
        supporting:document.querySelectorAll('.chronicle-secondary .cbb-news-story').length,
        department:document.querySelectorAll('.chronicle-news-departments section').length,
        brokenArchive:[...document.querySelectorAll('.chronicle-crest img')].filter(x=>!x.naturalWidth).map(x=>x.src),
        rankTitle:document.querySelector('#chronicle-retro-panel .chronicle-retro-lead')?.textContent||'',
        retroHref:document.getElementById('chronicle-retro-full-link')?.getAttribute('href'),
        visibleGender:[...document.querySelectorAll('.cbb-edition-switch .is-active')].map(x=>x.textContent.trim()),
        moreSummaryVisible:(()=>{const el=document.querySelector('.chronicle-more summary');const s=getComputedStyle(el);return s.display!=='none'&&el.getBoundingClientRect().width>0;})()
      };
    });
    if(props.scrollWidth>width+2)problems.push('Horizontal overflow '+props.scrollWidth+'/'+width);
    if(props.navItems!==5)problems.push('Expected five core newspaper destinations, got '+props.navItems);
    if(props.newsRect.top>props.retroRect.top||props.retroRect.top>props.indexRect.top)problems.push('Editorial hierarchy wrong');
    if(props.brokenArchive.length)problems.push('Broken local archival marks: '+props.brokenArchive.join(','));
    if(!props.rankTitle.includes('RETRO'))problems.push('No authenticated RETRO lead');
    if(props.retroHref!==(gender==='women'?'ncaaw-rankings.html?poll=retro':'ncaam-elo.html'))problems.push('Wrong gender RETRO link');
    if(props.visibleGender.length!==1||props.visibleGender[0] !== (gender==='women'?'Women':'Men'))problems.push('Gender switch not correctly selected');
    if(!props.moreSummaryVisible)problems.push('More section control hidden');
    await page.locator('.chronicle-more summary').click();
    if(!(await page.locator('.chronicle-more').evaluate(x=>x.open)))problems.push('More menu fails to expand');
    await page.screenshot({path:'artifacts/hardwood-'+gender+'-'+device+'.png',fullPage:true});
    findings.push({gender,device,problems,details:props});
   }catch(e){
    findings.push({gender,device,problems:[String(e)]});
   }finally{await context.close()}
  }
 }finally{await browser.close()}
 console.log(JSON.stringify(findings.map(x=>({edition:x.gender,viewport:x.device,issues:x.problems,details:x.details&&{navItems:x.details.navItems,scrollWidth:x.details.scrollWidth,viewport:x.details.viewport,department:x.details.department,brokenArchive:x.details.brokenArchive}})),null,2));
 assert(findings.every(x=>!x.problems.length),'Chronicle visual acceptance failed');
}
main().catch(e=>{console.error(e);process.exitCode=1});

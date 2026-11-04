// Runtime contract for 365 D-I logos and rigorously identified outside-D-I visitors.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const main=path.resolve(__dirname,'..');
const registry=JSON.parse(fs.readFileSync(path.join(main,'data/mbb-logo-registry.json'),'utf8'));
const cross=JSON.parse(fs.readFileSync(path.join(main,'data/ncaam-2026-27-espn-team-crosswalk.json'),'utf8'));
const colors=JSON.parse(fs.readFileSync(path.join(main,'data/dual-ring-team-palette.json'),'utf8'));
const outside=JSON.parse(fs.readFileSync(path.join(main,'data/mbb-out-of-division-opponent-logos.json'),'utf8'));
(async()=>{
 const ctx={window:{},document:{readyState:'loading',addEventListener(){},documentElement:null},
    fetch:async url=>({ok:true,json:async()=>String(url).includes('mbb-logo-registry')?registry:
      String(url).includes('espn-team-crosswalk')?cross:
      String(url).includes('dual-ring-team-palette')?colors:outside}),
    console,MutationObserver:class {observe(){}}
 };
 vm.runInNewContext(fs.readFileSync(path.join(main,'mbb-logo-system.js'),'utf8'),ctx);
 assert.equal(await ctx.window.MBBLogos.ready,true);
 assert.equal(Object.keys(registry.teams).length,365);
 const fram=ctx.window.MBBLogos.byESPN('126956','score','Framingham State Rams');
 assert.match(fram,/Primary_Logo_\.5x\.png/);
 assert.match(fram,/data-ring-count="2"/);
 const noid=ctx.window.MBBLogos.byESPN('','score','Framingham State');
 assert.match(noid,/Primary_Logo_\.5x\.png/);
 const blu=ctx.window.MBBLogos.byESPN('494','score','Blue Mountain Christian Toppers');
 assert.match(blu,/bluemtn\.sidearmsports\.com/);
 const grace=ctx.window.MBBLogos.byESPN('134743','score','Grace University Talons');
 assert.match(grace,/static\.wixstatic\.com/);
 const ambiguous=ctx.window.MBBLogos.byESPN('','score','Grace University');
 assert.match(ambiguous,/mbb-mark--missing/);
 const falseID=ctx.window.MBBLogos.byESPN('126956','score','Grace University Talons');
 assert.match(falseID,/mbb-mark--missing/);
 const d1=ctx.window.MBBLogos.byESPN('159','score','Dartmouth');
 assert.match(d1,/teamlogos\/ncaa\/500\/159\.png/);
 console.log('Passed shared 365-program plus outside Division I logo identity contract.');
})().catch(e=>{console.error(e);process.exitCode=1});

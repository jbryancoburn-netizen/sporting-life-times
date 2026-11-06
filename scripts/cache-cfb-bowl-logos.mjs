// One-time, isolated bowl-logo asset cache. No runtime external-image requests for cached marks.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const context = {window:{}};
vm.runInNewContext(fs.readFileSync('cfb-bowl-catalog.js','utf8'), context);
vm.runInNewContext(fs.readFileSync('cfb-bowl-editorial.js','utf8'), context);
const catalog=context.window.CFB_BOWL_CATALOG || [];
const editorial=context.window.CFB_BOWL_EDITORIAL || {};
const alternatives={
  "Boca Raton Bowl": [
    "https://shopbocabowl.com/media/logo/stores/7/9BBrtjqsLNKrYOBpWIN4HQW7MQAmQY4JVI4a6Fge.png"
  ],
  "Myrtle Beach Bowl": [
    "https://s.americanarenas.com/media/myrtle-beach-bowl.jpg"
  ],
  "Famous Idaho Potato Bowl": [
    "https://pbs.twimg.com/profile_images/826205474244669441/llShw20V_400x400.jpg"
  ],
  "Cure Bowl": [
    "https://f002.backblazeb2.com/file/cpbmedia/bowls/2526logos/25cure.jpg",
    "https://www.curebowl.com/wp-content/uploads/2024/05/2024_StaffDNA_Cure_Bowl-1.png"
  ],
  "Pinstripe Bowl": [
    "https://img.mlbstatic.com/mlb-images/image/private/t_w2208/mlb/dljh3g2nvueibs0pp7cj.png"
  ],
  "Fenway Bowl": [
    "https://cloudfront-us-east-1.images.arcpublishing.com/bostonglobe/VJ7UJ33NBJGVNACVEEYZGNK4HU.jpg"
  ],
  "Duke's Mayo Bowl": [
    "https://cdn.shopify.com/s/files/1/0731/0557/2152/files/DMBowl_Logo_Large_c83b8c8d-bb09-4771-834b-e0db54db9a8c.png?v=1686055004"
  ],
  "68 Ventures Bowl": [
    "https://assets.simpleviewinc.com/simpleview/image/upload/c_limit%2Ch_1200%2Cq_75%2Cw_1200/v1/crm/mobilebay/68-Ventures-Bowl-Primary-Logo_B1511365-DD00-3522-35FE8FB6EAB6F470-b1510e5cf941c9d_b1512dba-f22c-6c0b-a1f870463c3f8b1f.png"
  ],
  "Military Bowl": [
    "https://content.sportslogos.net/logos/68/4842/full/military_bowl_logo_primary_2024_sportslogosnet-5649.png"
  ],
  "Alamo Bowl": [
    "https://www.pikpng.com/pngl/b/446-4464382_alamo-bowl-valero-alamo-bowl-logo-clipart.png",
    "https://www.alamobowl.com/wp-content/uploads/2021/05/card-bowl-logos.jpg"
  ],
  "Gator Bowl": [
    "https://cdn.imgbin.com/14/9/12/taxslayer-gator-bowl-logo-taxslayer-gator-bowl-logo-c4WLBztk.jpg"
  ],
  "Music City Bowl": [
    "https://storage.googleapis.com/purduesports-com-prod/2025/05/16/f4Ab7cGvCJnI2CkV2KkIharUTN9Uu1bfurzscuhv.png"
  ],
  "Citrus Bowl": [
    "https://content.sportslogos.net/logos/68/5478/full/citrus_bowl_logo_primary_2023_sportslogosnet-4876.png"
  ],
  "Arizona Bowl": [
    "https://seatgeekimages.com/performers-landscape/arizona-bowl-79fde5/385214/600x600.jpg"
  ],
  "Liberty Bowl": [
    "https://library.sportingnews.com/styles/twitter_card_120x120/s3/2025-12/Liberty%20Bowl.jpg?itok=_nN75tTR"
  ],
  "Cactus Bowl": [
    "https://s.yimg.com/ny/api/res/1.2/OCYlAxhrtzRwUv4.rcNv4w--/YXBwaWQ9aGlnaGxhbmRlcjt3PTk2MDtoPTk2MDtjZj13ZWJw/https%3A/media.zenfs.com/en/azcentral-the-arizona-republic/ef922bbc261a65cfc521b5f8b28ea952",
    "https://pbs.twimg.com/media/HJ7MTC-bkAAL6a2.jpg"
  ],
  "Puerto Rico Bowl": [
    "https://pbs.twimg.com/media/HHzucCYXQAA0Iau.jpg"
  ],
  "Poinsettia Bowl": [
    "https://www.snapdragonstadium.com/assets/img/1440-x-500-px-1-a7d88cd384.png"
  ],
  "Salute to Veterans Bowl": [
    "https://content.sportslogos.net/logos/68/6926/full/salute-to-veterans-bowl-logo-primary-2024-5879.png"
  ]
};
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const out='assets/bowl-logos';
fs.mkdirSync(out,{recursive:true});
const manifest={}, report=[];
const sniff=buf=>{
 if(buf.length>=8 && buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';
 if(buf.length>=3 && buf.subarray(0,3).equals(Buffer.from([255,216,255])))return 'jpg';
 if(buf.length>=6 && buf.toString('ascii',0,3)==='GIF')return 'gif';
 if(buf.length>=12 && buf.toString('ascii',0,4)==='RIFF' && buf.toString('ascii',8,12)==='WEBP')return 'webp';
 if(buf.length>=100 && /<svg[\s>]/i.test(buf.toString('utf8',0,1000)))return 'svg';
 return null;
};
async function download(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),16000);
 try{
  const res=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'User-Agent':'Mozilla/5.0 (compatible; SLT-BowlLogo-Cache/1.0)','Accept':'image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*;q=0.8,*/*;q=0.2'}});
  if(!res.ok)throw Error('HTTP '+res.status);
  const size=Number(res.headers.get('content-length')||0);
  if(size>4500000)throw Error('too large');
  const data=Buffer.from(await res.arrayBuffer());
  if(data.length<100 || data.length>4500000)throw Error('invalid size '+data.length);
  const ext=sniff(data);
  if(!ext)throw Error('not an image');
  return {data,ext};
 } finally{clearTimeout(timer);}
}
for (const b of catalog) {
 const name=b.name;
 const opts=[...(alternatives[name]||[]),editorial[name]?.logo,b.logo].filter(Boolean);
 let found=null,errors=[];
 for(const url of [...new Set(opts)]){
  try{found={...await download(url),url};break;}catch(e){errors.push(e.message);}
 }
 if(found){
  const local=out+'/'+slug(name)+'.'+found.ext;
  fs.writeFileSync(local,found.data);
  manifest[name]=local;
  report.push({name,status:'cached',local,bytes:found.data.length,source:found.url});
 } else {
  const existing=fs.readdirSync(out).find(f=>f.startsWith(slug(name)+'.'));
  if(existing){manifest[name]=out+'/'+existing;report.push({name,status:'existing-local',local:manifest[name],errors});}
  else report.push({name,status:opts.length?'failed':'missing-source',errors});
 }
}
fs.writeFileSync('cfb-bowl-local-logos.js','window.CFB_BOWL_LOCAL_LOGOS='+JSON.stringify(manifest,null,2)+';\n');
fs.writeFileSync('data/cfb-bowl-logo-cache-report.json',JSON.stringify({updated:new Date().toISOString(),total:catalog.length,cached:Object.keys(manifest).length,report},null,2)+'\n');
console.log('BOWL LOGOS cached '+Object.keys(manifest).length+' / '+catalog.length);
for(const row of report)console.log(row.status.padEnd(15),row.name,(row.errors||[]).join(';'));
if(!Object.keys(manifest).length)process.exitCode=1;

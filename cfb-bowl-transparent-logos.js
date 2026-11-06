/* Keep authentic bowl marks; remove only exterior white/gray photo mattes.
 * Works on the same-origin bowl image assets, never on team logos.
 * The original image is retained if the canvas cannot be read.
 */
(()=>{
  'use strict';
  const cache=new Map();
  const audit={cleaned:0,alreadyTransparent:0,noWhiteMatte:0,errors:0};
  window.CFB_BOWL_LOGO_BACKGROUND_AUDIT=audit;

  // Flood-fill only neutral, light pixels connected to the canvas boundary.
  // White text and highlights inside dark logo outlines stay untouched.
  function eraseExteriorMatte(data,w,h){
    const pixels=data.data,total=w*h,queue=new Uint32Array(total),seen=new Uint8Array(total);
    const offset=n=>n*4;
    const pale=n=>{
      const k=offset(n),a=pixels[k+3],r=pixels[k],g=pixels[k+1],b=pixels[k+2];
      return a>=200&&Math.min(r,g,b)>=180&&Math.max(r,g,b)-Math.min(r,g,b)<=32;
    };
    const corners=[0,w-1,(h-1)*w,h*w-1];
    const lightCorners=corners.filter(pale).length;
    const transparentCorners=corners.filter(n=>pixels[offset(n)+3]<160).length;
    if(transparentCorners>=2)return {state:'transparent',removed:0};
    if(lightCorners<3)return {state:'no-matte',removed:0};

    let head=0,tail=0;
    const enqueue=n=>{
      if(seen[n])return;
      seen[n]=1;
      if(pale(n))queue[tail++]=n;
    };
    for(let x=0;x<w;x++){enqueue(x);enqueue((h-1)*w+x)}
    for(let y=1;y<h-1;y++){enqueue(y*w);enqueue(y*w+w-1)}
    while(head<tail){
      const n=queue[head++],x=n%w;
      if(x>0)enqueue(n-1);
      if(x<w-1)enqueue(n+1);
      if(n>=w)enqueue(n-w);
      if(n<total-w)enqueue(n+w);
    }
    if(tail<total*.015)return {state:'no-matte',removed:tail};
    for(let i=0;i<tail;i++)pixels[offset(queue[i])+3]=0;
    return {state:'cleaned',removed:tail};
  }

  function clean(img){
    if(!(img instanceof HTMLImageElement)||img.dataset.bowlMatteChecked==='yes')return;
    if(!img.closest('#bowl-content'))return;
    if(!img.matches('.bowl-identity-logo, img[alt="Authentic bowl logo"]'))return;
    const src=img.getAttribute('src')||'';
    if(!/^assets\/bowl-logos\//.test(src))return;
    if(!img.complete||!img.naturalWidth)return;
    img.dataset.bowlMatteChecked='yes';
    if(cache.has(src)){
      const result=cache.get(src);
      if(result)img.src=result;
      return;
    }
    try{
      const scale=Math.min(1,680/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.max(1,Math.round(img.naturalWidth*scale));
      const h=Math.max(1,Math.round(img.naturalHeight*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx)throw Error('No 2D context');
      ctx.drawImage(img,0,0,w,h);
      const data=ctx.getImageData(0,0,w,h);
      const r=eraseExteriorMatte(data,w,h);
      if(r.state==='transparent'){audit.alreadyTransparent++;cache.set(src,null);return}
      if(r.state!=='cleaned'){audit.noWhiteMatte++;cache.set(src,null);return}
      ctx.putImageData(data,0,0);
      const cleanSrc=canvas.toDataURL('image/png');
      cache.set(src,cleanSrc);
      img.src=cleanSrc;
      audit.cleaned++;
    }catch(e){audit.errors++;console.warn('Bowl logo matte cleanup skipped:',src,e)}
  }
  // Catch future bowl cards, dynamically rendered after live data loads.
  document.addEventListener('load',e=>{if(e.target instanceof HTMLImageElement)clean(e.target)},true);
  const scan=()=>document.querySelectorAll('#bowl-content .bowl-identity-logo, #bowl-content img[alt="Authentic bowl logo"]').forEach(clean);
  document.addEventListener('DOMContentLoaded',scan);
  const observer=new MutationObserver(scan);
  observer.observe(document.getElementById('bowl-content')||document.documentElement,{childList:true,subtree:true});
})();
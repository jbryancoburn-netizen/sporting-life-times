/* Deterministic Elo tournament scenario engine. Hypothetical high-v-low seeded
   single-elimination draw, byes to next power of two. NOT official conference formats. */
window.NCAAMForecast=(()=>{
 const probability=(a,b)=>1/(1+Math.pow(10,-((a.elo-b.elo)/400)));
 const bracketSize=n=>2**Math.ceil(Math.log2(Math.max(n,2)));
 const seedPositions=n=>{if(n===1)return [1];const p=seedPositions(n/2);return p.flatMap(x=>[x,n+1-x])};
 function simulate(ranked){
   if(!Array.isArray(ranked)||ranked.length<2)return [];
   const ordered=[...ranked].sort((a,b)=>b.elo-a.elo);
   const size=bracketSize(ordered.length),positions=seedPositions(size);
   let level=positions.map(k=>{let t=ordered[k-1];return t?new Map([[t.team_id,{team:t,p:1}]]):new Map()});
   const progress=new Map(ordered.map(t=>[t.team_id,{team:t,rounds:[],champion:0}]));
   let round=0;
   while(level.length>1){
     const next=[];
     for(let i=0;i<level.length;i+=2){
       const left=level[i],right=level[i+1];
       const merged=new Map();
       for(const [id,x] of left){
         let survive=right.size?0:1;
         if(right.size)for(const y of right.values())survive+=y.p*probability(x.team,y.team);
         merged.set(id,{team:x.team,p:x.p*survive});
       }
       for(const [id,x] of right){
         let survive=left.size?0:1;
         if(left.size)for(const y of left.values())survive+=y.p*probability(x.team,y.team);
         merged.set(id,{team:x.team,p:x.p*survive});
       }
       for(const [id,x] of merged)progress.get(id).rounds[round]=x.p;
       next.push(merged);
     }
     level=next;round++;
   }
   const final=level[0];for(const [id,x] of final)progress.get(id).champion=x.p;
   const output=[...progress.values()].sort((a,b)=>b.champion-a.champion);
   const total=output.reduce((s,x)=>s+x.champion,0);
   if(Math.abs(total-1)>1e-7)throw Error("Champion probabilities must total 100%");
   return output;
 }
 return {probability,simulate,bracketSize};
})();
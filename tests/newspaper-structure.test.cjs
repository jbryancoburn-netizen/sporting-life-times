/* Newspaper structure regression tests; run with node --test tests/*.test.cjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pages=fs.readFileSync('edition-pages.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const desks=fs.readFileSync('department-stories.js','utf8');
const app=fs.readFileSync('app.js','utf8');
test('every edition section is defined in the newspaper HTML',()=>{
 const block=pages.match(/const editions=\[([\s\S]*?)\];/);
 assert.ok(block,'edition configuration exists');
 const ids=[...block[1].matchAll(/ids:\[([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]));
 assert.ok(ids.length>=14,'expected full newspaper section inventory');
 assert.equal(new Set(ids).size,ids.length,'duplicate edition section');
 for(const id of ids)assert.match(html,new RegExp('id=["\\\']'+id+'["\\\']'),'missing section '+id);
});
test('football department does not include UFL and explicitly excludes UFL stories',()=>{
 assert.match(desks,/'pro-football':/);
 assert.match(desks,/id!=='pro-football'\|\|!/);
 assert.match(desks,/ufl/);
 assert.doesNotMatch(html,/NFL\s*[·|/]\s*CFL\s*[·|/]\s*UFL/i);
});
test('shared scoreboard renderer is reused by newspaper sections',()=>{
 assert.match(app,/function registerGames\(/);
 assert.match(app,/function teamRows\(/);
 assert.ok((app.match(/registerGames\(/g)||[]).length>=2,'register renderer should be reused');
});

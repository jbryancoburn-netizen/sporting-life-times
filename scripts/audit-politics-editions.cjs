/* Read-only nationwide political edition architecture smoke test.
   Run: node scripts/audit-politics-editions.cjs */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const checks=[];
function check(name,fn){try{fn();checks.push({name,ok:true})}catch(e){checks.push({name,ok:false,error:e.message})}}
const manifest=JSON.parse(read('politics-geometry/manifest.json'));
check('Census geography manifest: 50 states',()=>assert.equal(manifest.states,50));
check('Census geography manifest: 435 districts',()=>assert.equal(manifest.districts,435));
check('All state GeoJSON files available',()=>{
const states=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
assert.equal(states.filter(s=>fs.existsSync(path.join(root,'politics-geometry',s+'.geojson'))).length,50);
});
for(const [type,filename]of [['state','politics-house-state.html'],['district','politics-house-district.html']]){
const html=read(filename);
check(type+' edition loads shared newspaper styling',()=>assert.match(html,/politics-ledger-editions\.css/));
check(type+' edition retains its correct page mode',()=>assert.match(html,new RegExp('data-house-page="'+type+'"')));
}
const state=read('politics-house-state.html'),district=read('politics-house-district.html'),map=read('politics-house-map.js');
check('State map selector and accessible explanation',()=>{assert.match(state,/id="map-shading-controls"/);assert.match(state,/id="map-shading-explanation"/);});
check('State map links to individual districts',()=>assert.match(map,/location\.href=urlForDistrict\(id\)/));
check('Default map shows neutral geographic view',()=>assert.match(map,/let mapView="geography"/));
check('Map labels use viewport collision suppression',()=>assert.match(map,/const collides=occupied\.some/));
check('District edition has local geographic map',()=>assert.match(district,/id="dossier-map"/));
check('Script compiles',()=>new Function(map));
checks.forEach(x=>console.log((x.ok?'PASS':'FAIL')+' '+x.name+(x.error?' — '+x.error:'')));
const failures=checks.filter(x=>!x.ok);console.log(checks.length-failures.length+'/'+checks.length+' checks passed');
if(failures.length)process.exitCode=1;

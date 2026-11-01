"""Contract tests for a prediction-first but nonprobabilistic House desk."""
import pathlib,unittest,subprocess
R=pathlib.Path(__file__).parent
class EarlyReadTests(unittest.TestCase):
 def test_early_read(self):
  script=(R/"politics-house.js").read_text()
  html=(R/"politics-house-state.html").read_text()
  css=(R/"politics-house.css").read_text()
  for x in ["function preliminaryRaceRead(r)","function raceReadPanel(r)","function raceReasonPanel(r)","link.append(top,early,field,evidence,reasons,foot)",'filter==="watch"&&preliminaryRaceRead(x).watch']:self.assertIn(x,script)
  for x in ['id="state-watch-count"','value="watch"',"POLITICS_HOUSE_CARD_DESIGN_SPEC.md"]:self.assertIn(x,html)
  self.assertIn("EARLY RACE READ:",css)
 def test_all_435_have_three_reasons_without_fake_win_odds(self):
  js=r"""
const assert=require('assert'),fs=require('fs');
const src=fs.readFileSync('politics-house.js','utf8');
const g=src.slice(src.indexOf('function districtGraphicData(r){'),src.indexOf('function renderDistrictGraphic(r){'));
const o=src.slice(src.indexOf('function preliminaryRaceRead(r){'),src.indexOf('function raceReadPanel(r){'));
const fn=new Function('fmt','one',g+o+'return preliminaryRaceRead')(x=>Number(x).toLocaleString('en-US'),x=>Number(x).toFixed(1));
const a=JSON.parse(fs.readFileSync('politics-house-atlas.json','utf8'));
const get=id=>a.districts.find(x=>x.id===id);
assert.equal(fn(get('IA-02')).label,'Signals disagree');
assert.equal(fn(get('IA-04')).kind,'2024 ACTUAL HOUSE RESULT');
assert.equal(fn(get('MN-08')).label,'Early Republican edge');
assert.equal(fn(get('FL-22')).label,'New map, open race');
let n=0;
for(const r of a.districts){const x=fn(r);assert.equal(x.reasons.length,3);assert(!x.label.includes('%'));if(x.watch)n++;if(r['2026_boundaries_revised'])assert(!x.reasons.some(z=>z.head==='2024 HOUSE'&&z.value.includes('pts')))}
assert(n>0&&n<435);console.log(n+' early watchlist races tested');
"""
  r=subprocess.run(["node","-e",js],cwd=R,timeout=15,capture_output=True,text=True)
  self.assertEqual(r.returncode,0,r.stdout+"\n"+r.stderr)
if __name__=="__main__":unittest.main()

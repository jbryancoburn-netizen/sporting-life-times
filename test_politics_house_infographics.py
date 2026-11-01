"""Verify source-aware congressional district infographics with real atlas fixtures."""
import json
import shutil
import subprocess
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parent

class HouseInfographicTests(unittest.TestCase):
 def test_source_labels_and_chart_safety_guards(self):
  js=(ROOT/"politics-house.js").read_text()
  css=(ROOT/"politics-house.css").read_text()
  for term in ("function districtGraphicData(r)",'p.question_type==="named_house"',"hist?.same_2026_geography&&hist.both_major_parties",'bar.setAttribute("role","img")','newEl("div",null,"graphic-empty")','portraitNode(r,c)',"source-chip"):
   self.assertIn(term,js)
  self.assertIn("HOUSE DATA INFOGRAPHICS v1",css)
  self.assertIn("infographic-track",css)
  self.assertIn("@media(max-width:430px)",css)

 def test_correct_poll_results_and_redistricting_boundaries(self):
  if not shutil.which("node"):self.skipTest("Node JS runtime unavailable")
  node=r"""
const fs=require('fs'),assert=require('assert');
const rows=JSON.parse(fs.readFileSync('politics-house-atlas.json','utf8')).districts;
const js=fs.readFileSync('politics-house.js','utf8');
const chunk=js.slice(js.indexOf('function districtGraphicData(r){'),js.indexOf('function renderDistrictGraphic(r){'));
const graphic=new Function('fmt',chunk+';return districtGraphicData')(n=>Number(n).toLocaleString('en-US'));
const r=id=>{const x=rows.find(v=>v.id===id);assert(x,id);return x};
const close=(x,y)=>assert(Math.abs(x-y)<.2,x+' vs '+y);
let a=graphic(r('IA-01'));assert.equal(a.type,'poll');close(a.dem,40);close(a.rep,35);close(a.other,25);assert(a.label.includes('SECONDARY'));
a=graphic(r('IA-03'));assert.equal(a.type,'poll');close(a.dem,42);close(a.rep,48);
a=graphic(r('IA-04'));assert.equal(a.type,'historical');close(a.dem,32.8);close(a.rep,67.2);assert(a.foot.includes('NOT a 2026 poll'));
a=graphic(r('FL-22'));assert.equal(a.type,'unavailable');assert.equal(a.dem,null);
assert.equal(graphic(r('MA-01')).type,'unavailable');
const invalid={...r('IA-04'),district_specific_2026_polls:[{question_type:'named_house',candidates:[{party:'D',pct:67},{party:'R',pct:51}]}]};
assert.equal(graphic(invalid).type,'historical');
"""
  p=subprocess.run(["node","-e",node],cwd=ROOT,timeout=15,capture_output=True,text=True)
  self.assertEqual(p.returncode,0,p.stdout+"\n"+p.stderr)

if __name__=="__main__":unittest.main()

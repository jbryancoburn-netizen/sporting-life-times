"""The Political Life & Times: purple watch, party identity and Census silhouettes."""
import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class NewsGraphicsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.js=(ROOT/"politics-house.js").read_text(encoding="utf-8")
        cls.art=(ROOT/"politics-state-art.js").read_text(encoding="utf-8")
        cls.html=(ROOT/"politics-house-state.html").read_text(encoding="utf-8")
        cls.css=(ROOT/"politics-house.css").read_text(encoding="utf-8")
        cls.atlas=json.loads((ROOT/"politics-house-atlas.json").read_text(encoding="utf-8"))

    def test_visual_controls_and_attribution(self):
        for id_ in ["state-hero-art","state-headline-watch","state-headline-conflicts",
                    "state-headline-ballots","state-spotlight","news-watch-link","district-list"]:
            self.assertEqual(self.html.count('id="'+id_+'"'),1,id_)
        self.assertIn("politics-state-art.js?v=20261101-graphics-1",self.html)
        self.assertIn("newsgraphics-purple1",self.html)
        self.assertIn('value="watch"',self.html)
        self.assertIn("Font Awesome Free icons (CC BY 4.0)",self.html)
        self.assertIn('https://fontawesome.com/license/free',self.html)
        self.assertIn("NEWS GRAPHICS DESK / PURPLE WATCH EDITION",self.css)
        self.assertIn('--news-purple:#6f4bae',self.css)
        self.assertIn('--news-purple-deep:#53348a',self.css)
        self.assertIn('--news-purple-light:#eee7f8',self.css)
        self.assertIn("--news-purple-border:#8b6bc2",self.css)
        self.assertIn(".theme-purple .marker",self.css)
        self.assertIn(".candidate-versus .field-person",self.css)
        self.assertIn(".state-hero-watermark",self.css)
        self.assertIn(".district-watermark",self.css)
        self.assertIn(".faceoff-versus",self.css)
        self.assertIn("partySeal(c.party)",self.js)
        self.assertIn("Font Awesome political-animal icons",self.js)
        self.assertIn('select.value="watch";paint()',self.js)
        self.assertIn('theme-"+theme',self.js)

    def test_census_shapes_match_real_verified_districts(self):
        self.assertIn("PoliticsStateArt",self.art)
        self.assertIn('json?.meta?.state!==code',self.art)
        self.assertIn("json.features.length!==expected",self.art)
        self.assertIn('politics-geometry/"+code+".geojson',self.art)
        self.assertIn('code==="AK"&&rawX>0?rawX-360:rawX',self.art)
        self.assertEqual(self.atlas["district_count"],435)
        total=0
        for state in self.atlas["states"]:
            path=ROOT/"politics-geometry"/(state["code"]+".geojson")
            self.assertTrue(path.is_file(),path.name)
            data=json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(data["meta"]["state"],state["code"])
            self.assertEqual(len(data["features"]),state["district_count"])
            total+=len(data["features"])
        self.assertEqual(total,435)

    def test_all_watch_cards_are_purple_and_no_fake_probabilities(self):
        if not shutil.which("node"):self.skipTest("Node is required for JavaScript test")
        node=r"""
const fs=require('fs'),assert=require('assert');
const js=fs.readFileSync('politics-house.js','utf8');
const block=js.slice(js.indexOf('function districtGraphicData(r){'),js.indexOf('function renderDistrictGraphic(r){'))+
js.slice(js.indexOf('function preliminaryRaceRead(r){'),js.indexOf('function raceReadPanel(r){'))+
js.slice(js.indexOf('function graphicTheme(r,read){'),js.indexOf('function openCardIcon(){'));
const theme=new Function('fmt','one',block+'return {read:preliminaryRaceRead,theme:graphicTheme}')(
 n=>Number(n).toLocaleString('en-US'),n=>Number(n).toFixed(1));
const atlas=JSON.parse(fs.readFileSync('politics-house-atlas.json','utf8'));
let watch=0,mixed=0;
for(const r of atlas.districts){
  const read=theme.read(r),style=theme.theme(r,read);
  if(read.watch){assert.strictEqual(style,'purple',r.id);watch++;}
  if(read.label==='Signals disagree'){assert.strictEqual(style,'purple');mixed++;}
  assert(!read.label.includes('%'),r.id);
  if(r['2026_boundaries_revised'])assert(!read.reasons.some(x=>x.head==='2024 HOUSE'&&x.value.includes('pts')),r.id);
}
assert(watch>0&&watch<435);
assert(mixed>0);
console.log('Validated '+watch+' purple watch cards, '+mixed+' conflicting-signal cards.');
"""
        p=subprocess.run(["node","-e",node],cwd=ROOT,text=True,capture_output=True,timeout=25)
        self.assertEqual(p.returncode,0,p.stdout+"\n"+p.stderr)

if __name__=="__main__":unittest.main()

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


    def test_district_profile_is_visual_and_keeps_raw_evidence_distinct(self):
        district=(ROOT/"politics-house-district.html").read_text(encoding="utf-8")
        visual=(ROOT/"politics-house-district-visual.css").read_text(encoding="utf-8")
        ids=["district-front","front-map-art","front-title","front-read",
             "front-field","front-chart","front-facts","district-updated",
             "leader-badge","coverage-board"]
        for ident in ids:
            with self.subTest(id=ident):
                self.assertEqual(district.count('id="'+ident+'"'),1)
        self.assertIn("politics-house-district-visual.css?v=20261101-editorial1",district)
        self.assertIn("politics-state-art.js",district)
        self.assertLess(district.index('id="district-front"'),district.index('id="metrics"'))
        self.assertIn('<details id="coverage-section"',district)
        self.assertIn('function renderDistrictFront(r,state){',self.js)
        self.assertIn('renderDistrictFront(r,state);',self.js)
        self.assertIn('renderDistrictGraphic(r)',self.js)
        self.assertIn('raceReasonPanel(r)',self.js)
        self.assertIn('portraitNode(r,c,true)',self.js)
        self.assertIn('if(!ballot?.candidates?.length)',self.js)
        self.assertIn('window.PoliticsStateArt.prepare(r.state,state.district_count)',self.js)
        self.assertIn('front-theme-purple',visual)
        self.assertIn('front-theme-dem',visual)
        self.assertIn('front-theme-rep',visual)
        self.assertIn('front-theme-history',visual)
        self.assertIn('grid-template-columns:1fr',visual)
        self.assertIn('NOT a 2026 poll or forecast.',self.js)
        self.assertIn('not a guaranteed winner',district.lower())
        self.assertNotIn('win probability 60%',district.lower())


    def test_435_districts_have_real_editorial_stories_without_fabricated_swing(self):
        """Iowa source samples and every district must preserve poll/history separation."""
        district=(ROOT/"politics-house-district.html").read_text(encoding="utf-8")
        state=(ROOT/"politics-house-state.html").read_text(encoding="utf-8")
        visual=(ROOT/"politics-race-experience.css").read_text(encoding="utf-8")
        engine=(ROOT/"politics-race-experience.js").read_text(encoding="utf-8")
        for marker in ["politics-race-experience.js","politics-race-experience.css","politics-race-branding.js","politics-race-branding.css"]:
            self.assertIn(marker,district)
        for marker in ["race-snapshots","race-experience"]:
            self.assertIn(marker,engine)
        self.assertIn('id="race-receipts"',district)
        self.assertNotIn('id="iowa-edition"',district)
        for marker in ["state-editorial-stories","politics-race-experience.js","politics-race-experience.css"]:
            self.assertIn(marker,state)
        self.assertIn('role","tablist"',engine)
        self.assertIn('role","tabpanel"',engine)
        self.assertIn('ArrowRight',engine)
        self.assertIn('aria-selected',engine)
        self.assertIn('race-snapshot-panel[hidden]{display:none!important}',visual)
        self.assertIn('grid-template-columns:1fr',visual)
        self.assertNotIn('2026 win odds:',engine.lower())
        if not shutil.which("node"):self.skipTest("Node required for source-based narrative test")
        node=r"""
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const context={window:{}};vm.runInNewContext(fs.readFileSync('politics-race-experience.js','utf8'),context);
const api=context.window.PoliticsRaceExperience;
const atlas=JSON.parse(fs.readFileSync('politics-house-atlas.json','utf8'));
assert.strictEqual(atlas.districts.length,435);
const byId=new Map(atlas.districts.map(r=>[r.id,r]));
const ia01=api.story(byId.get('IA-01'));
assert.strictEqual(ia01.diff,799);
assert(ia01.headline.includes('799 votes'));
assert(ia01.sub.includes('Michael Bridgford'));
assert(ia01.sub.includes('11.0%'));
assert.strictEqual(ia01.pm,5);
const ia02=api.story(byId.get('IA-02'));
assert(ia02.headline.includes('different directions'));
assert.strictEqual(ia02.diff,63600);
const ia03=api.story(byId.get('IA-03'));
assert.strictEqual(ia03.diff,15784);
assert.strictEqual(ia03.pm,-6);
const ia04=api.story(byId.get('IA-04'));
assert.strictEqual(ia04.p,null);
assert(ia04.sub.includes('Chris McGowan')&&ia04.sub.includes('Dave Dawson'));
let changed=0,withPoll=0;
for(const r of atlas.districts){
 const data=api.story(r);
 assert(data.headline.length>20,r.id);
 assert.strictEqual(data.items.length,3,r.id);
 if(r['2026_boundaries_revised']){
   changed++;
   assert.strictEqual(data.h,null,r.id+' changed boundaries were used as historic baseline');
 }
 if(data.p){withPoll++;assert(data.items[1].unit.startsWith('2026 REPORTED POLL'));}
 if(!data.p)assert(!data.sub.includes('poll lists '),r.id);
}
assert(changed>0&&withPoll>50);
console.log('Iowa 4/4 checked; all '+atlas.districts.length+' distinct House races use source-specific editorial metrics.');
"""
        test=subprocess.run(["node","-e",node],cwd=ROOT,text=True,capture_output=True,timeout=25)
        self.assertEqual(test.returncode,0,test.stdout+"\\n"+test.stderr)

if __name__=="__main__":unittest.main()

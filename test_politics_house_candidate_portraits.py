"""Portrait rights, candidate identity, and 50px political controls should never regress."""
import json
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent

class CandidatePhotoUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest=json.loads((ROOT/"politics-candidate-photos.json").read_text(encoding="utf-8"))
        cls.ballots=json.loads((ROOT/"politics-official-ballots.json").read_text(encoding="utf-8"))
        cls.script=(ROOT/"politics-house.js").read_text(encoding="utf-8")
        cls.css=(ROOT/"politics-house.css").read_text(encoding="utf-8")
        cls.state=(ROOT/"politics-house-state.html").read_text(encoding="utf-8")
        cls.district=(ROOT/"politics-house-district.html").read_text(encoding="utf-8")

    def test_portrait_identity_must_exactly_match_government_candidate_record(self):
        m=self.manifest
        self.assertEqual(m["status"],"SOURCE_MATCHED_CANDIDATE_PORTRAITS_PARTIAL")
        self.assertEqual(m["coverage"],len(m["photos"]))
        self.assertGreaterEqual(m["coverage"],27)
        races={r["id"]:r["candidates"] for r in self.ballots["races"] if r["office"]=="H"}
        ids=set()
        for photo in m["photos"]:
            key=(photo["race_id"],photo["candidate_name"],photo["party"])
            with self.subTest(candidate=key):
                self.assertNotIn(key,ids);ids.add(key)
                self.assertIn(photo["race_id"],races)
                self.assertTrue(any(c["name"]==photo["candidate_name"] and c["party"]==photo["party"] for c in races[photo["race_id"]]))
                self.assertTrue(photo["image_url"].startswith("https://"))
                self.assertTrue(photo["source_url"].startswith("https://"))
                if "unitedstates.github.io" in photo["image_url"]:
                    self.assertEqual(photo["license"],"public_domain")
                    self.assertRegex(photo["bioguide_id"],r"^[A-Z][0-9]{6}$")
                    self.assertTrue(photo["image_url"].endswith("/"+photo["bioguide_id"]+".jpg"))
                    self.assertIn("bioguide.congress.gov",photo["source_identity_url"])
                else:
                    self.assertIn("commons.wikimedia.org/wiki/Special:FilePath/",photo["image_url"])
                    self.assertEqual(photo["license"],"copyrighted_free_use_with_vrt_permission")
                    self.assertIn("commons.wikimedia.org/wiki/File:",photo["source_url"])

    def test_both_counters_on_iowa_first_and_third_races_have_real_photos(self):
        p={(x["race_id"],x["candidate_name"]) for x in self.manifest["photos"]}
        for key in [
            ("IA-01","Christina Bohannan"),("IA-01","Mariannette Miller-Meeks"),
            ("IA-03","Zach Nunn"),("IA-03","Sarah Trone Garriott")
        ]:self.assertIn(key,p)

    def test_no_synthetic_faces_or_invented_photo_assignments(self):
        self.assertIn('housePortraits.get(r.id+"|"+c.name+"|"+c.party)',self.script)
        self.assertIn('b.name===c.name&&b.party===c.party',self.script)
        self.assertIn("img.onerror=()=>{img.remove()",self.script)
        self.assertIn('newEl("span",initials(c.name)',self.script)
        self.assertIn('portraitNode(r,c,true)',self.script)
        self.assertIn('item.append(portraitNode(r,c))',self.script)
        self.assertNotIn("source.unsplash.com",self.script)
        self.assertNotIn("randomuser.me",self.script)
        self.assertNotIn("pravatar.cc",self.script)

    def test_large_controls_use_vector_arrows_and_conspicuous_party_badges(self):
        self.assertIn("function openCardIcon()",self.script)
        self.assertIn("http://www.w3.org/2000/svg",self.script)
        self.assertIn('newEl("span",info.party||"—","marker")',self.script)
        self.assertIn('mark.title=',self.script)
        self.assertIn('.district-card::after{content:none!important',self.css)
        self.assertIn('width:51px;height:51px',self.css)
        self.assertIn(".card-open",self.css)
        self.assertIn("candidate-portrait",self.css)
        self.assertIn("politics-candidate-photos.json",self.script)
        self.assertIn("portrait-source-note",self.state)
        for page in [self.state,self.district]:
            self.assertIn("20261101-candidate-portraits2",page)

if __name__=="__main__":
    unittest.main()

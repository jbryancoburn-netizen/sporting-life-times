import datetime as dt,json,tempfile,unittest
from pathlib import Path
from publish_eps_epl import validate,publish
class EPLEditorialTests(unittest.TestCase):
    def sample(self):
        now=dt.datetime.now(dt.timezone.utc)
        issued=(now-dt.timedelta(hours=1)).isoformat()
        kickoff=(now+dt.timedelta(days=1)).isoformat()
        return {"schema_version":1,"competition":"EPL","status":"provisional_research",
            "model":"eps-9.2-elo-poisson-50-50-research","source_provider":"espn-eng1",
            "source_sha256":"a"*64,"issued_at_utc":issued,
            "fixtures":[{"fixture_id":"1","kickoff_utc":kickoff,"issued_at_utc":issued,
             "home":{"id":"11","name":"Home","elo":1500,"expected_goals":1.5},
             "away":{"id":"12","name":"Away","elo":1500,"expected_goals":1.2},
             "probabilities":{"home":.4,"draw":.3,"away":.3}}]}
    def test_valid_export(self):
        with tempfile.TemporaryDirectory() as d:
            source=Path(d)/"src.json";out=Path(d)/"out.json"
            source.write_text(json.dumps(self.sample()))
            self.assertEqual(publish(source,out),1)
            self.assertTrue(out.exists())
    def test_reject_bad_goal_market_complements(self):
        data=self.sample();data['fixtures'][0]['goal_markets']={'over_2_5':.7,'under_2_5':.7,'both_teams_to_score_yes':.4,'both_teams_to_score_no':.6}
        with self.assertRaisesRegex(ValueError,'inconsistent goal market'):validate(data)
    def test_reject_bad_probabilities(self):
        data=self.sample();data["fixtures"][0]["probabilities"]["home"]=.9
        with self.assertRaises(ValueError):validate(data)
    def test_reject_stale(self):
        data=self.sample();data["issued_at_utc"]=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(days=3)).isoformat()
        with self.assertRaises(ValueError):validate(data)
if __name__=="__main__":unittest.main()

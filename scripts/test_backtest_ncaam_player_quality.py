import importlib.util, pathlib, tempfile, json, unittest
p=pathlib.Path(__file__).with_name("backtest_ncaam_player_quality.py")
spec=importlib.util.spec_from_file_location("quality",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def row(season,id,win):
    return dict(season_end_year=season,game_id=str(id),game_date=f"{season-1}-11-20",
    preseason_cutoff=f"{season-1}-10-15",source_snapshot_at=f"{season-1}-10-01",
    prior_stats_latest_date=f"{season-1}-04-01",home_win=win,
    home_base_elo=1500,away_base_elo=1500,home_minutes_adjustment=0,
    away_minutes_adjustment=0,quality_home=0.5 if win else -0.5,quality_away=0)
class TestQualityBacktest(unittest.TestCase):
    def test_split_and_outcome(self):
        x=m.run([row(s,i,i%2) for s in (2024,2025,2026) for i in range(8)])
        self.assertEqual(x["holdout_season"],2026)
        self.assertEqual(x["baseline_minutes_model"]["games"],8)
        self.assertTrue(x["passes_both_metrics"])
    def test_leakage_rejected(self):
        r=row(2026,1,1);r["source_snapshot_at"]="2026-02-01"
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"in.jsonl";p.write_text(json.dumps(r)+chr(10))
            with self.assertRaisesRegex(ValueError,"LEAKAGE"):m.load(p)
if __name__=="__main__": unittest.main()

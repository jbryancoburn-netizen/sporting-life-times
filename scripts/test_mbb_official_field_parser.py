import importlib.util,pathlib,unittest
p=pathlib.Path(__file__).with_name('mbb_complete_official_fields.py')
spec=importlib.util.spec_from_file_location('fields',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class OfficialSchedules(unittest.TestCase):
 def test_explicit_neutral_over_vs(self):
  html='''<title>2026-27 Basketball Schedule</title><li class="sidearm-schedule-game sidearm-schedule-neutral-game" data-game-id="1"><div class="sidearm-schedule-game-opponent-name">Example College</div><div class="sidearm-schedule-game-opponent-date"><span>Nov 12</span><span>7 PM</span></div><div class="sidearm-schedule-game-location"><span>Town, FL</span><span>Sample Arena</span></div></li>'''
  row=m.parse(html)[0];self.assertEqual(row['site'],'neutral');self.assertEqual(row['arena'],'Sample Arena')
 def test_both_teams_in_wmt_card(self):
  html='''<title>2026-27 Basketball Schedule</title><div class="schedule-event-item"><div class="schedule-event-date schedule-event-date--venue-home"><time datetime="2026-11-03T19:00:00-05:00"></time></div><strong class="schedule-default-event__name">Georgia Tech Yellow Jackets</strong><strong class="schedule-default-event__name">Georgia Southern</strong></div>'''
  rows=m.parse(html,('Georgia Tech','Georgia Tech Yellow Jackets'));self.assertEqual(rows[0]['opponent'],'Georgia Southern')
 def test_wrong_season_rejected(self):
  self.assertEqual(m.parse('<title>2025-26 Schedule</title>'),[])
 def test_only_named_confirmed_fixture_added(self):
  team=m.TEAMS[0];base=dict(time='7 PM',arena='Sample Arena',city='Town',tv='',site='neutral',site_explicit=True,exhibition=False)
  rows=[dict(base,date='2026-11-03',opponent='Example College'),dict(base,date='2026-11-04',opponent='NCAA Final Four'),dict(base,date='2026-11-05',opponent=team['name']),dict(base,date='2026-10-20',opponent='Other College',exhibition=True)]
  doc={'events':[]};self.assertEqual(m.add_missing_games(doc,team,rows,'https://official.example/schedule'),1);self.assertEqual(m.add_missing_games(doc,team,rows,'https://official.example/schedule'),0)
if __name__=='__main__':unittest.main()

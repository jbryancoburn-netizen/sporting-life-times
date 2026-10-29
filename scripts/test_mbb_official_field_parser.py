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
 def test_published_network_logo_filename(self):
  import base64
  asset=base64.urlsafe_b64encode(b'https://storage.googleapis.com/school/2026/secnetwork-plus.png').decode().rstrip('=')
  html='<title>Basketball Schedule 2026-27</title><div class="schedule-item home"><div class="schedule-item__date">Nov 3</div><div class="schedule-item__team"><h3>Example College</h3><p>Sample Arena | Town, KY</p></div><span class="schedule-item__result">7:00 pm</span><div class="schedule-item__bottom"><img alt="Link Image" src="https://official.example/imgproxy/fit/100/'+asset+'.png"></div></div>'
  row=m.parse(html)[0];self.assertEqual(row['tv'],'SEC Network+');self.assertEqual(row['arena'],'Sample Arena');self.assertEqual(row['city'],'Town, KY')
 def test_site_label_is_not_a_facility(self):
  html='<title>Basketball Schedule 2026-27</title><div class="schedule-event-item"><div class="schedule-event-date"><time class="schedule-event-date__month-day">Nov 3</time></div><strong class="schedule-default-event__name">Example College</strong><span class="schedule-event-location">Charlottesville, Va.</span><span class="schedule-event-item__venue">home</span></div>'
  row=m.parse(html)[0];self.assertEqual(row['site'],'home');self.assertEqual(row['arena'],'');self.assertEqual(row['city'],'Charlottesville, Va.')
 def test_combined_official_locations(self):
  self.assertEqual(m.split_location('Greenville, SC / Timmons Arena'),('Timmons Arena','Greenville, SC'))
  self.assertEqual(m.split_location('Colonial Life Arena (Columbia, S.C.)'),('Colonial Life Arena','Columbia, S.C.'))
  self.assertEqual(m.split_location('Farris Center'),('Farris Center',''))
 def test_rank_prefix_is_not_part_of_school_identity(self):
  for label in ['#24 Purdue','RV/#24 Purdue','No. 4 Purdue','RV Purdue']:self.assertEqual(m.norm(label),'purdue')
if __name__=='__main__':unittest.main()

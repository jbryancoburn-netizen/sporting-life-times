import importlib.util,pathlib,unittest
ROOT=pathlib.Path(__file__).parent
def load(name):
 spec=importlib.util.spec_from_file_location(name,ROOT/(name+'.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
fields=load('mbb_complete_official_fields');identity=load('mbb_reconcile_saved_official_evidence');clean=load('mbb_clean_calendar_entries')
class CalendarRecovery(unittest.TestCase):
 def test_network_images_remain_specific(self):
  from bs4 import BeautifulSoup
  for label,result in [('TNT_Logo_2016','TNT'),('CBS_Sports_Network_Black','CBS Sports Network'),('SEC_Network_Plus.png','SEC Network+'),('CBS Sports',''),('Example College Logo','')]:
   image=BeautifulSoup('<img>','html.parser').img;image['alt']=label;self.assertEqual(fields.image_network_label(image),result)
 def test_network_combinations_and_streaming_brands(self):
  for label in ['FloCollege','ESPN2/U/ACCN','TNT / HBO Max','NEC Front Row']:self.assertTrue(fields.network_label(label))
  for label in ['Live Stats','Radio','Tickets','Read More']:self.assertFalse(fields.network_label(label))
 def test_womens_schedule_is_rejected(self):
  self.assertEqual(fields.parse("<title>2026-27 Women's Basketball Schedule</title>"),[])
 def test_semifinal_is_not_a_confirmed_fixture(self):
  base={'time':'7 PM','arena':'Sample Arena','city':'Town','tv':'ESPN','site':'neutral','site_explicit':True,'exhibition':False}
  rows=[dict(base,date='2027-03-16',opponent='Semifinals'),dict(base,date='2027-03-17',opponent='Quarterfinals'),dict(base,date='2027-03-18',opponent='Sweet 16'),dict(base,date='2026-11-24',opponent='Liberty vs. Princeton'),dict(base,date='2026-11-25',opponent='Presented by Cedars-Sinai')]
  doc={'events':[]};self.assertEqual(fields.add_missing_games(doc,fields.TEAMS[0],rows,'https://official.example/schedule'),0)
 def test_institutional_names_keep_meaning(self):
  self.assertNotEqual(identity.schoolkey('Boston College'),identity.schoolkey('Boston University'))
  self.assertEqual(identity.resolve('Southern Indiana'),'88')
 def test_promotion_labels_do_not_resolve_as_teams(self):
  for label in ['Presented by Cedars-Sinai','Homecoming | ASUN Doubleheader','Hometown Home Opener']:self.assertFalse(identity.resolve(label))
if __name__=='__main__':unittest.main()

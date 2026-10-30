import json, pathlib, tempfile, unittest
from unittest.mock import patch
import mbb_conference_schedule_recovery as m

class ConferenceRecoveryTests(unittest.TestCase):
    def test_two_column_pdf_and_alternative_time(self):
        text = '''2026-27 Big 12 Time (ET)
Nov. 2 Ohio State vs. BYU 9 p.m. FS1   Jan. 23 Kansas at Kansas State Noon/8 p.m. FOX
'''
        rows = m.big_twelve(text,'source')
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['relation'],'vs.')
        self.assertEqual(rows[1]['time'],'Noon/8 p.m.')
        self.assertEqual(rows[1]['date'],'2027-01-23')

    def test_rowspan_and_blank_date(self):
        text = '''SEC on ESPN Networks 2026-27<table>
<tr><td rowspan="2">Mon, Nov 2</td><td rowspan="2">6 p.m.</td><td>Neutral event</td><td rowspan="2">ESPN2</td></tr>
<tr><td>No. 18 Miami vs. No. 1 Florida</td></tr>
<tr><td></td><td>9 p.m.</td><td>Chicago State at Texas</td><td>SEC Network</td></tr></table>'''
        rows = m.sec_release(text,'source')
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[1]['date'],'2026-11-02')
        self.assertEqual(rows[0]['tv'],'ESPN2')
        self.assertEqual(rows[0]['relation'],'unspecified')

    def test_contextual_identity(self):
        self.assertEqual(m.team_id('USC','bigtensports'), '30')
        self.assertEqual(m.team_id('No. 18 Miami','secsports.com'), '2390')
        self.assertFalse(m.team_id('TBD'))

    def test_exact_pair_and_existing_announcements(self):
        with tempfile.TemporaryDirectory() as temp:
            root = pathlib.Path(temp); folder = root/'mbb-schedules-2026-27'; folder.mkdir()
            doc = {'events':[{'id':'real','date':'2026-11-02T17:00Z','official_school_time':'8 p.m. ET',
                'competitions':[{'competitors':[{'team':{'id':'41'}},{'team':{'id':'130'}}]}]}]}
            (folder/'41.json').write_text(json.dumps(doc))
            row = dict(date='2026-11-02',visitor='Connecticut',host='Michigan',relation='vs.',time='7 p.m.',tv='TNT',city='',source_url='official')
            wrong = dict(row,host='Michigan State',tv='FOX')
            with patch.object(m,'DATA',root),patch.object(m,'EVIDENCE',root/'evidence.json'),patch.object(m,'REPORT',root/'report.json'):
                m.recover({'rows':[wrong,row]})
            result=json.loads((folder/'41.json').read_text())['events'][0]
            self.assertEqual(result['official_school_time'],'8 p.m. ET')
            self.assertEqual(result['competitions'][0]['broadcasts'][0]['names'],['TNT'])
            self.assertNotIn('site_verified',result)

if __name__=='__main__':unittest.main()

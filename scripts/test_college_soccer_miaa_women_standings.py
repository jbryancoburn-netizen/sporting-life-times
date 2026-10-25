"""Offline MIAA women's conference records: nine program parsing and fail-closed tests."""
import unittest
from update_college_soccer_miaa_women_standings import TEAMS, parse_table

RECORDS={
"Calvin":"5-0-1","Kalamazoo":"5-1","Albion":"3-2-1",
"Hope":"5-0-1","Adrian":"2-5","Alma":"2-4",
"Trine":"3-2-1","Olivet":"0-6","Saint Mary's":"1-6"}
def table(rows):
 body=['<table><thead><tr><th>School</th><th>Record</th><th>Conf. GP</th><th>Conf. Record</th><th>CPts</th><th>Overall</th></tr></thead><tbody>']
 for team,record in rows.items():
  w,l,*d=map(int,record.split('-'))
  gp=w+l+sum(d)
  cp=w*3+sum(d)
  body.append(f'<tr><td>{team}</td><td>9-4-2</td><td>{gp}</td><td>{record}</td><td>{cp}</td><td>9-4-2</td></tr>')
 return ''.join(body)+'</tbody></table>'
class WomenMIAATest(unittest.TestCase):
 def test_full_table(self):
  result=parse_table(table(RECORDS))
  self.assertEqual(set(result),set(TEAMS.values()))
  self.assertEqual(result["calvin"]["conference_points"],16)
  self.assertEqual(result["st-marys-in"]["conference_record"],"1-6")
 def test_missing_team_refused(self):
  rows=RECORDS.copy()
  del rows["Olivet"]
  with self.assertRaises(ValueError):parse_table(table(rows))
 def test_wrong_points_refused(self):
  page=table(RECORDS).replace('<td>16</td>','<td>96</td>',1)
  # Parsing should reject contradictory wins/draws and conference points.
  with self.assertRaises(ValueError):parse_table(page)
if __name__=="__main__":unittest.main()

"""NCAA soccer CCIW official standings parser: complete and fail-closed checks."""
import unittest
from update_college_soccer_cciw_standings import SCHOOLS, rows_from_html

NAMES={"north-central-il":"North Central","north-park":"North Park","ill-wesleyan":"Illinois Wesleyan","wheaton-il":"Wheaton","millikin":"Millikin","augustana-il":"Augustana","carroll-wi":"Carroll","elmhurst":"Elmhurst","carthage":"Carthage"}
RECORDS={"north-central-il":"5-0-2","north-park":"4-0-2","ill-wesleyan":"4-1-2","wheaton-il":"3-2-2","millikin":"3-4","augustana-il":"2-2-2","carroll-wi":"2-3-1","elmhurst":"1-5-1","carthage":"0-7"}
def page(recs,overwrite=None):
 html='<table><thead><tr><th>School</th><th>Conf</th><th>Overall</th><th>CCIW Points</th></tr></thead><tbody>'
 for key,rec in recs.items():
  a,b,*d=map(int,rec.split('-'))
  pts=3*a+(d[0] if d else 0)
  if overwrite and key in overwrite:pts=overwrite[key]
  html+=f'<tr><td>{NAMES[key]}</td><td>{rec}</td><td>9-4-2</td><td>{pts}</td></tr>'
 return html+'</tbody></table>'
class TestCCIW(unittest.TestCase):
 def test_complete(self):
  r=rows_from_html(page(RECORDS))
  self.assertEqual(set(r),set(SCHOOLS))
  self.assertEqual(r["north-central-il"]["conference_points"],17)
  self.assertEqual(r["ill-wesleyan"]["conference_points"],14)
 def test_incomplete_refused(self):
  r=RECORDS.copy()
  del r["carthage"]
  with self.assertRaises(ValueError):rows_from_html(page(r))
 def test_wrong_points_refused(self):
  with self.assertRaises(ValueError):rows_from_html(page(RECORDS,{"north-park":99}))
 def test_conflicting_duplicate_refused(self):
  html=page(RECORDS).replace("</tbody>","<tr><td>North Park</td><td>0-7</td><td>1-8-0</td><td>0</td></tr></tbody>")
  with self.assertRaises(ValueError):rows_from_html(html)
if __name__=="__main__":unittest.main()

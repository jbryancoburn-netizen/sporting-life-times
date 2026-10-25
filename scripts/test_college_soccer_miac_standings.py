"""Offline fixture checks for MIAC standings parser; no network."""
import unittest
from update_college_soccer_miac_standings import ALIASES, parse_rows

LABELS={
 'st-olaf':'St. Olaf','gust-adolphus':'Gustavus','carleton':'Carleton',
 'saint-johns-mn':"Saint John's",'augsburg':'Augsburg',
 'st-scholastica':'St. Scholastica','macalester':'Macalester',
 'hamline':'Hamline','bethel-mn':'Bethel',
 'concordia-mhead':'Concordia',"st-marys-mn":"Saint Mary's"
}
RECORDS={
 'st-olaf':'7-0','gust-adolphus':'6-0-1','carleton':'6-2',
 'saint-johns-mn':'5-2-1','augsburg':'4-2-3','st-scholastica':'4-4',
 'macalester':'3-4-1','hamline':'1-5-2','bethel-mn':'1-5-2',
 'concordia-mhead':'0-6-3','st-marys-mn':'0-7-1'
}

def html(rows):
    lines=['<table><thead><tr><th>TEAM</th><th>CPts</th><th>Conf</th><th>Overall</th></tr></thead><tbody>']
    for team,record in rows.items():
        w,l,*d=(int(v) for v in record.split('-'))
        points=3*w+(d[0] if d else 0)
        lines.append(f'<tr><td>{LABELS[team]}</td><td>{points}</td><td>{record}</td><td>9-4-2</td></tr>')
    return ''.join(lines+['</tbody></table>'])

class MIACTest(unittest.TestCase):
    def test_complete(self):
        result=parse_rows(html(RECORDS))
        self.assertEqual(set(result),set(ALIASES))
        self.assertEqual(result['st-olaf']['conference_points'],21)
        self.assertEqual(result['gust-adolphus']['conference_points'],19)
        self.assertEqual(result['augsburg']['conference_games'],9)

    def test_missing_fails_closed(self):
        partial=RECORDS.copy()
        partial.pop('st-marys-mn')
        with self.assertRaises(ValueError):parse_rows(html(partial))

    def test_conflicting_duplicate_fails(self):
        same=html(RECORDS).replace('</tbody>', '<tr><td>St. Olaf</td><td>1</td><td>0-7</td><td>3-5</td></tr></tbody>')
        with self.assertRaises(ValueError):parse_rows(same)

if __name__=="__main__":
    unittest.main()

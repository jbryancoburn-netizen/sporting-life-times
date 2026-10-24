"""Verify the live NCAA matchup model and immutable archived forecasts."""
import datetime as dt,json,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HOST='https://jbryancoburn-netizen.github.io/sporting-life-times/'

def fetch(path):
    request=urllib.request.Request(HOST+path+'?verify='+str(time.time()),headers={'Cache-Control':'no-cache','User-Agent':'SLT-Matchup-Integrity/2.0'})
    with urllib.request.urlopen(request,timeout=20) as r:return r.read().decode('utf-8')

def main():
    expected=json.loads((ROOT/'data/college-soccer-prospective-v2.json').read_text())
    for trial in range(15):
        try:
            got=json.loads(fetch('data/college-soccer-prospective-v2.json'))
            assert got['model']=='ncaa_matchup_draw_v2' and got['count_locked']==len(got['forecasts'])
            rows={r['match_id']:r for r in got['forecasts']}
            assert len(rows)==len(got['forecasts'])
            for r in expected['forecasts']:assert rows.get(r['match_id'])==r,'archived forecast differs'
            for r in got['forecasts']:
                made=dt.datetime.fromisoformat(r['forecasted_at_utc']);start=dt.datetime.fromisoformat(r['kickoff_utc'])
                assert made.tzinfo and start.tzinfo and made<start
                assert abs(sum(r[k] for k in ('p_home','p_draw','p_away'))-1)<1e-7
            assert len({r['p_draw'] for r in got['forecasts']})>1,'draws still constant'
            html=fetch('college-soccer.html');js=fetch('college-soccer-predictions.js')
            assert 'id="college-soccer-predictions"' in html and 'college-soccer-predictions.js' in html
            assert 'data/college-soccer-prospective-v2.json' in js and 'ncaa_matchup_draw_v2' in js
            assert 'Date.parse(g.kickoff_utc)>Date.now()' in js
            print(json.dumps({'status':'PASS','model':got['model'],'locked':len(rows),'distinct_draws':len({r['p_draw'] for r in got['forecasts']})}))
            return
        except Exception as exc:
            print('Not verified yet',trial+1,str(exc),flush=True)
            if trial==14:raise
            time.sleep(12)

if __name__=='__main__':main()
